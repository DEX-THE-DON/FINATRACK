import { Hono } from 'hono';
import { AppEnv, getSupabaseClient } from '../db/supabase';

export const authRoutes = new Hono<{ Bindings: AppEnv }>();

authRoutes.post('/auth/signup', async (c) => {
  const body = await c.req.parseBody();
  const email = String(body['email'] || '').trim();
  const password = String(body['password'] || '').trim();
  const firstName = String(body['first_name'] || '').trim();
  const lastName = String(body['last_name'] || '').trim();
  const name = String(body['name'] || `${firstName} ${lastName}`.trim() || firstName || '').trim();
  const redirectTo = String(body['redirect_to'] || '/');

  if (!email || !password) {
    return c.redirect(`${redirectTo}?toast=Email+and+password+required`, 303);
  }

  const supabase = getSupabaseClient(c.env);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name || email.split('@')[0],
      }
    }
  });

  if (error) {
    return c.redirect(`${redirectTo}?toast=${encodeURIComponent(error.message)}`, 303);
  }

  if (data?.session) {
    const uname = name || email.split('@')[0];
    c.header('Set-Cookie', `sb-access-token=${data.session.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${data.session.expires_in}`);
    c.header('Set-Cookie', `finatrack_user=${encodeURIComponent(uname)}; Path=/; SameSite=Lax; Max-Age=${data.session.expires_in}`, { append: true });
    return c.redirect(`${redirectTo}?toast=Welcome+to+Finatrack,+${encodeURIComponent(uname)}!`, 303);
  }

  return c.redirect(`${redirectTo}?toast=Signup+successful!+Check+your+email+to+confirm`, 303);
});

authRoutes.post('/auth/login', async (c) => {
  const body = await c.req.parseBody();
  const email = String(body['email'] || '').trim();
  const password = String(body['password'] || '').trim();
  const redirectTo = String(body['redirect_to'] || '/');

  const supabase = getSupabaseClient(c.env);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return c.redirect(`${redirectTo}?toast=${encodeURIComponent(error.message)}`, 303);
  }

  if (data?.session) {
    const uname = data.user?.user_metadata?.full_name || data.user?.email?.split('@')[0] || 'Member';
    c.header('Set-Cookie', `sb-access-token=${data.session.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${data.session.expires_in}`);
    c.header('Set-Cookie', `finatrack_user=${encodeURIComponent(uname)}; Path=/; SameSite=Lax; Max-Age=${data.session.expires_in}`, { append: true });
    return c.redirect(`${redirectTo}?toast=Welcome+back,+${encodeURIComponent(uname)}!`, 303);
  }

  return c.redirect(`${redirectTo}?toast=Logged+in+successfully`, 303);
});

authRoutes.post('/auth/logout', async (c) => {
  const body = (await c.req.parseBody().catch(() => ({}))) as Record<string, any>;
  const redirectTo = String(body['redirect_to'] || '/');
  c.header('Set-Cookie', 'sb-access-token=; Path=/; HttpOnly; Max-Age=0');
  c.header('Set-Cookie', 'finatrack_user=; Path=/; Max-Age=0', { append: true });
  return c.redirect(`${redirectTo}?toast=Logged+out+successfully`, 303);
});

