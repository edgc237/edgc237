// POST /api/attempt
// Enregistre une auto-évaluation pour l'élève AUTHENTIFIÉ (token vérifié).
// Le téléphone/l'identité ne sont plus pris depuis le body — ils viennent
// du token, donc impossibles à usurper.
//
// Header requis : Authorization: Bearer <access_token Supabase>
// Body attendu  : { fasciculeId, score, completed, timeMinutes, confidence, fullName? }

const { createClient } = require('@supabase/supabase-js');
const { requireUser } = require('./_auth');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // clé serveur uniquement
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const user = await requireUser(req); // lève 401 si token absent/invalide

    const { fasciculeId, score, completed, timeMinutes, confidence, fullName } = req.body || {};

    if (!fasciculeId) {
      return res.status(400).json({ error: 'Fascicule requis' });
    }
    const scoreNum = Number(score);
    if (!Number.isFinite(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      return res.status(400).json({ error: 'Score invalide (0-100 attendu)' });
    }
    const confidenceNum = confidence !== undefined && confidence !== null ? Number(confidence) : null;
    if (confidenceNum !== null && (!Number.isFinite(confidenceNum) || confidenceNum < 0 || confidenceNum > 100)) {
      return res.status(400).json({ error: 'Confiance invalide (0-100 attendu)' });
    }

    // Compléter le nom si le profil vient d'être créé sans nom
    if (fullName && typeof fullName === 'string' && fullName.trim().length >= 2) {
      await supabaseAdmin
        .from('app_users')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id)
        .eq('full_name', ''); // ne remplace pas un nom déjà renseigné
    }

    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('fascicule_attempts')
      .insert({
        user_id: user.id,
        fascicule_id: fasciculeId,
        score: scoreNum,
        completed: !!completed,
        time_minutes: timeMinutes ? Number(timeMinutes) : null,
        confidence: confidenceNum,
      })
      .select('id')
      .single();

    if (attemptError) throw attemptError;

    return res.status(201).json({ ok: true, attemptId: attempt.id });
  } catch (err) {
    if (err.status === 401) return res.status(401).json({ error: err.message });
    console.error('POST /api/attempt error:', err);
    return res.status(500).json({ error: 'Erreur serveur, réessaie dans un instant.' });
  }
};
