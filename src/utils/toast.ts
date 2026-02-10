type ToastType = 'success' | 'error' | 'info';

export function showToast(message: string, type: ToastType = 'success', duration = 4000) {
  try {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const containerId = 'global-toast-container';

    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'fixed';
      container.style.top = '1rem';
      container.style.right = '1rem';
      container.style.zIndex = '9999';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.id = id;
    toast.style.marginTop = '0.5rem';
    toast.style.minWidth = '200px';
    toast.style.maxWidth = '360px';
    toast.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)';
    toast.style.borderRadius = '0.5rem';
    toast.style.padding = '0.6rem 0.9rem';
    toast.style.color = '#fff';
    toast.style.fontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '0.6rem';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 240ms ease, transform 240ms ease';
    toast.style.transform = 'translateY(-6px)';

    const bg = type === 'success' ? '#059669' : type === 'error' ? '#DC2626' : '#2563EB';
    toast.style.background = bg;

    const content = document.createElement('div');
    content.style.flex = '1';
    content.style.fontSize = '0.95rem';
    content.innerText = message;

    toast.appendChild(content);
    container.appendChild(toast);

    // trigger enter
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    const remove = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-6px)';
      setTimeout(() => {
        try { container?.removeChild(toast); } catch(e) {}
      }, 240);
    };

    const timeoutId = window.setTimeout(remove, duration);

    // close on click
    toast.addEventListener('click', () => {
      clearTimeout(timeoutId);
      remove();
    });
  } catch (err) {
    // Fallback a alert si algo falla
    try { alert(message); } catch(e) {}
  }
}

export default showToast;
