// Utilitaire partagé : vérifie le token Bearer envoyé par le client et
// renvoie l'utilisateur Supabase authentifié correspondant. Utilisé par
// toutes les fonctions /api/* qui exigent un élève connecté.

const { createClient } = require('@supabase/supabase-js');

// Client "anon" — uniquement pour vérifier les tokens, jamais pour écrire.
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function requireUser(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    const err = new Error('Non authentifié — connecte-toi avec ton numéro.');
    err.status = 401;
    throw err;
  }

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error('Session invalide ou expirée — reconnecte-toi.');
    err.status = 401;
    throw err;
  }

  return data.user; // { id, phone, ... }
}

module.exports = { requireUser };
