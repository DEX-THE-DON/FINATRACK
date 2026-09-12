import { Hono } from 'hono';
import { AppEnv, getSupabaseClient } from '../db/supabase';

export const authRoutes = new Hono<{ Bindings: AppEnv }>();

authRoutes.post('/auth/signup', async (c) => {
  const body = await c.req.parseBody();
  const email = String(body['email'] || '').trim();
  const password = String(body['password'] || '').trim();

  if (!email || !password) {
    return c.redirect('/?toast=Email+and+password+required', 303);
  }

  const supabase = getSupabaseClient(c.env);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return c.redirect(`/?toast=${encodeURIComponent(error.message)}`, 303);
  }

  return c.redirect('/?toast=Signup+successful!+Check+your+email+to+confirm', 303);
});

authRoutes.post('/auth/login', async (c) => {
  const body = await c.req.parseBody();
  const email = String(body['email'] || '').trim();
  const password = String(body['password'] || '').trim();

  const supabase = getSupabaseClient(c.env);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return c.redirect(`/?toast=${encodeURIComponent(error.message)}`, 303);
  }

  if (data?.session) {
    c.header('Set-Cookie', `sb-access-token=${data.session.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${data.session.expires_in}`);
  }

  return c.redirect('/?toast=Logged+in+successfully', 303);
});

authRoutes.post('/auth/logout', async (c) => {
  c.header('Set-Cookie', 'sb-access-token=; Path=/; HttpOnly; Max-Age=0');
  return c.redirect('/?toast=Logged+out', 303);
});
