// ============================================================================
// auth.js — Login con Supabase Auth (email/password)
// Bloquea el acceso a la app hasta que exista una sesión válida.
// ============================================================================
import { supabase } from './db.js';
import { el, toast } from './utils.js';

export async function ensureAuthenticated() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;

  return new Promise((resolve) => {
    renderLoginOverlay(resolve);
  });
}

function renderLoginOverlay(onSuccess) {
  const overlay = el('div', { class: 'auth-overlay', id: 'auth-overlay' });

  const emailInput = el('input', { type: 'email', placeholder: 'correo@arauco.cl', required: 'true', autocomplete: 'username' });
  const passInput = el('input', { type: 'password', placeholder: 'Contraseña', required: 'true', autocomplete: 'current-password' });
  const submitBtn = el('button', { type: 'submit', class: 'btn btn-primary' }, 'Ingresar');
  const errorMsg = el('p', { class: 'auth-error', id: 'auth-error' });

  const form = el('form', { class: 'auth-form' }, [
    el('div', { class: 'brand-mark auth-mark' }, 'A'),
    el('h2', { class: 'auth-title' }, 'Patio Madera ARAUCO'),
    el('p', { class: 'view-sub auth-sub' }, 'Ingresa con tu cuenta para acceder al control de flujo.'),
    el('div', { class: 'field' }, [el('label', {}, 'Correo'), emailInput]),
    el('div', { class: 'field' }, [el('label', {}, 'Contraseña'), passInput]),
    errorMsg,
    submitBtn,
  ]);

  overlay.appendChild(form);
  document.body.appendChild(overlay);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.textContent = 'Ingresando...';
    submitBtn.disabled = true;
    errorMsg.textContent = '';

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput.value,
      password: passInput.value,
    });

    if (error) {
      errorMsg.textContent = error.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos.'
        : error.message;
      submitBtn.textContent = 'Ingresar';
      submitBtn.disabled = false;
      return;
    }

    overlay.remove();
    onSuccess(data.session);
  });
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.reload();
}
