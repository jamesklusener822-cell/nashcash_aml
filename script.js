// Neon cursor glow follows the mouse pointer
const glow = document.getElementById('cursor-glow');
document.addEventListener('mousemove', (e) => {
  glow.style.left = e.pageX + 'px';
  glow.style.top = e.pageY + 'px';
});