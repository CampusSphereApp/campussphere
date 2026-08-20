const menu=document.querySelector('.menu'), links=document.querySelector('.links');
menu.addEventListener('click',()=>{const open=links.classList.toggle('open');menu.setAttribute('aria-expanded',open)});
document.querySelectorAll('.links a').forEach(a=>a.addEventListener('click',()=>links.classList.remove('open')));
document.querySelectorAll('.event button').forEach(b=>b.addEventListener('click',()=>b.textContent=b.textContent==='♡'?'♥':'♡'));
document.querySelectorAll('.club-grid button').forEach(b=>b.addEventListener('click',()=>b.textContent=b.textContent==='Join'?'Joined':'Join'));
