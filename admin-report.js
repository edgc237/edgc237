// GET /api/admin-report
// Renvoie la liste des élèves pilotes avec leur IPE calculé — réservé au rôle ADMIN.
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

function computeIpe(attempts) {
  if (!attempts.length) return { ipe: 0, avgScore: 0, completionRate: 0, regularityRate: 0 };
  const avgScore = attempts.reduce((s, a) => s + a.score, 0) / attempts.length;
  const completionRate = (attempts.filter(a => a.completed).length / attempts.length) * 100;
  const now = new Date();
  const weeks = new Set();
  attempts.forEach(a => {
    const d = Math.floor((now - new Date(a.created_at)) / (7 * 24 * 60 * 60 * 1000));
    if (d >= 0 && d < 4) weeks.add(d);
  });
  const regularityRate = (weeks.size / 4) * 100;
  const ipe = Math.round(avgScore * 0.5 + completionRate * 0.3 + regularityRate * 0.2);
  return { ipe, avgScore: Math.round(avgScore), completionRate: Math.round(completionRate), regularityRate: Math.round(regularityRate) };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const user = await requireUser(req);

    // Vérifier que l'utilisateur authentifié est bien ADMIN
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('app_users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;
    if (!profile || profile.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }

    const { data: students, error: studentsError } = await supabaseAdmin
      .from('app_users')
      .select('id, full_name, phone, created_at')
      .eq('role', 'STUDENT')
      .order('created_at', { ascending: false });

    if (studentsError) throw studentsError;

    const { data: allAttempts, error: attemptsError } = await supabaseAdmin
      .from('fascicule_attempts')
      .select('user_id, score, completed, created_at');

    if (attemptsError) throw attemptsError;

    const report = students.map(s => {
      const attempts = allAttempts.filter(a => a.user_id === s.id);
      const stats = computeIpe(attempts);
      return {
        fullName: s.full_name || '(sans nom)',
        phone: s.phone,
        attemptsCount: attempts.length,
        ...stats,
        palier: palier(stats.ipe),
      };
    }).sort((a, b) => b.ipe - a.ipe);

    return res.status(200).json({ students: report, totalStudents: students.length });
  } catch (err) {
    if (err.status === 401) return res.status(401).json({ error: err.message });
    console.error('GET /api/admin-report error:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
};
