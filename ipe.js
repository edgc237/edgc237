// GET /api/ipe
// Calcule l'IPE de l'élève AUTHENTIFIÉ uniquement (plus de "?phone=" en
// clair — n'importe qui pouvait auparavant lire l'IPE de n'importe quel
// numéro. Faille corrigée : le token prouve l'identité).
//
// Header requis : Authorization: Bearer <access_token Supabase>

const { createClient } = require('@supabase/supabase-js');
const { requireUser } = require('./_auth');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function palier(ipe) {
  if (ipe < 40) return 'Démarrage';
  if (ipe < 65) return 'En progression';
  if (ipe < 85) return 'Maîtrise en cours';
  return 'Compétence validée';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const user = await requireUser(req);

    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from('fascicule_attempts')
      .select('score, completed, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (attemptsError) throw attemptsError;

    if (!attempts || attempts.length === 0) {
      return res.status(200).json({
        ipe: 0,
        palier: palier(0),
        attemptsCount: 0,
        message: 'Aucune tentative enregistrée pour le moment.',
      });
    }

    const avgScore = attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length;
    const completionRate = (attempts.filter(a => a.completed).length / attempts.length) * 100;

    const now = new Date();
    const weeksActive = new Set();
    attempts.forEach(a => {
      const diffWeeks = Math.floor((now - new Date(a.created_at)) / (7 * 24 * 60 * 60 * 1000));
      if (diffWeeks >= 0 && diffWeeks < 4) weeksActive.add(diffWeeks);
    });
    const regularityRate = (weeksActive.size / 4) * 100;

    const ipe = Math.round(avgScore * 0.5 + completionRate * 0.3 + regularityRate * 0.2);

    return res.status(200).json({
      ipe,
      palier: palier(ipe),
      attemptsCount: attempts.length,
      details: {
        avgScore: Math.round(avgScore),
        completionRate: Math.round(completionRate),
        regularityRate: Math.round(regularityRate),
      },
    });
  } catch (err) {
    if (err.status === 401) return res.status(401).json({ error: err.message });
    console.error('GET /api/ipe error:', err);
    return res.status(500).json({ error: 'Erreur serveur, réessaie dans un instant.' });
  }
};
