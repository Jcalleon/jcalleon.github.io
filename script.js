// Placeholder click feedback — flash the element so it's obvious what's a stand-in
document.querySelectorAll('[data-placeholder]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    el.classList.add('placeholder-flash');
    setTimeout(() => el.classList.remove('placeholder-flash'), 900);
  });
});
