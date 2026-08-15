/**
 * builder — generates complete, self-contained, WORKING web apps as a single
 * HTML document so they can be previewed live in the Artifacts panel.
 * Everything (HTML + CSS + JS) is inlined, so apps run offline in a sandboxed
 * iframe with zero dependencies.
 */

export interface BuiltApp {
  title: string;
  html: string;
}

const wrap = (title: string, body: string, script: string, css = "") =>
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:linear-gradient(135deg,#faf9f5,#ece9df);min-height:100vh;color:#1f1e1d;-webkit-font-smoothing:antialiased}
  .wrap{max-width:520px;margin:0 auto;padding:24px}
  h1{font-weight:600;letter-spacing:-.02em}
  ${css}
</style>
</head>
<body>
${body}
<script>
${script}
</script>
</body>
</html>`;

/* ------------------------------- Calculator ------------------------------- */
function calculator(): BuiltApp {
  const css = `
  .calc{max-width:320px;margin:40px auto;background:#1f1e1d;border-radius:26px;padding:20px;box-shadow:0 24px 60px rgba(40,30,15,.28)}
  .screen{background:#0e0e0d;color:#fff;font-size:42px;text-align:right;padding:20px 16px;border-radius:18px;margin-bottom:16px;min-height:86px;display:flex;align-items:flex-end;justify-content:flex-end;word-break:break-all;font-variant-numeric:tabular-nums}
  .keys{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  button{border:0;border-radius:16px;font-size:21px;padding:20px 0;cursor:pointer;background:#3a3835;color:#fff;transition:.12s}
  button:hover{filter:brightness(1.18)}button:active{transform:scale(.95)}
  .op{background:#d97757}.eq{background:#d97757;grid-column:span 2}.fn{background:#56544f}`;
  const body = `<div class="wrap"><div class="calc">
  <div class="screen" id="s">0</div>
  <div class="keys">
    <button class="fn" data-k="C">C</button><button class="fn" data-k="back">⌫</button>
    <button class="fn" data-k="%">%</button><button class="op" data-k="/">÷</button>
    <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button class="op" data-k="*">×</button>
    <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button><button class="op" data-k="-">−</button>
    <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button><button class="op" data-k="+">+</button>
    <button data-k="0" style="grid-column:span 2">0</button><button data-k=".">.</button><button class="eq" data-k="=">=</button>
  </div></div></div>`;
  const script = `var e="";var s=document.getElementById("s");
  document.querySelector(".keys").addEventListener("click",function(ev){var b=ev.target.closest("button");if(!b)return;var k=b.getAttribute("data-k");press(k);});
  function press(k){if(k==="C"){e="";}else if(k==="back"){e=e.slice(0,-1);}else if(k==="="){try{e=String(eval(e.replace(/%/g,"/100*")));}catch(err){e="Error";}}else{if(e==="Error")e="";e+=k;}s.textContent=e===""?"0":e;}
  window.addEventListener("keydown",function(ev){var m={"*":"*","+":"+","-":"-","/":"/","%":"%",".":".","Enter":"=","=":"=","Backspace":"back","Escape":"C"};var c=m[ev.key]||(ev.key>="0"&&ev.key<="9"?ev.key:null);if(c){press(c);}});`;
  return { title: "Calculator", html: wrap("Calculator", body, script, css) };
}

/* ---------------------------------- Todo ---------------------------------- */
function todo(): BuiltApp {
  const css = `
  .card{max-width:480px;margin:32px auto;background:#fff;border-radius:20px;padding:24px;box-shadow:0 18px 50px rgba(40,30,15,.12)}
  h1{font-size:24px;margin-bottom:4px}p.sub{color:#87867e;margin-bottom:18px}
  .add{display:flex;gap:8px;margin-bottom:18px}
  input{flex:1;border:1.5px solid #e5e3da;border-radius:12px;padding:13px 14px;font-size:15px;background:#faf9f5}
  input:focus{outline:none;border-color:#d97757}
  button.add{background:#d97757;color:#fff;border:0;border-radius:12px;padding:0 18px;font-size:15px;font-weight:600;cursor:pointer}
  button.add:hover{background:#c15f3f}
  ul{list-style:none}
  li{display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid #f0eee6}
  li.done span{text-decoration:line-through;color:#a8a69d}
  .box{width:22px;height:22px;border:2px solid #d97757;border-radius:7px;cursor:pointer;display:grid;place-items:center;flex-shrink:0}
  li.done .box{background:#d97757;color:#fff}
  li span{flex:1;font-size:15px;cursor:pointer}
  .del{background:none;border:0;color:#a8a69d;cursor:pointer;font-size:18px;padding:4px}
  .del:hover{color:#c15f3f}
  .foot{display:flex;justify-content:space-between;align-items:center;margin-top:14px;color:#87867e;font-size:13px}`;
  const body = `<div class="wrap"><div class="card">
  <h1>📝 My Tasks</h1><p class="sub">Tap to complete · stays saved on this device</p>
  <div class="add"><input id="inp" placeholder="Add a task…" maxlength="80"><button class="add" id="add">Add</button></div>
  <ul id="list"></ul>
  <div class="foot"><span id="count">0 tasks</span><button class="del" id="clear" style="font-size:13px">Clear done</button></div>
  </div></div>`;
  const script = `var items=JSON.parse(localStorage.getItem("todo")||"[]");
  var list=document.getElementById("list");var inp=document.getElementById("inp");
  function save(){localStorage.setItem("todo",JSON.stringify(items));}
  function render(){list.innerHTML="";items.forEach(function(t,i){
    var li=document.createElement("li");if(t.d)li.className="done";
    li.innerHTML='<div class="box">'+(t.d?'✓':'')+'</div><span></span><button class="del">✕</button>';
    li.querySelector("span").textContent=t.text;
    li.querySelector(".box").onclick=function(){items[i].d=!items[i].d;save();render();};
    li.querySelector("span").onclick=function(){items[i].d=!items[i].d;save();render();};
    li.querySelector(".del").onclick=function(){items.splice(i,1);save();render();};
    list.appendChild(li);});
    var left=items.filter(function(t){return !t.d;}).length;
    document.getElementById("count").textContent=left+" of "+items.length+" left";}
  function add(){var v=inp.value.trim();if(!v)return;items.push({text:v,d:false});inp.value="";save();render();}
  document.getElementById("add").onclick=add;inp.addEventListener("keydown",function(e){if(e.key==="Enter")add();});
  document.getElementById("clear").onclick=function(){items=items.filter(function(t){return !t.d;});save();render();};
  render();`;
  return { title: "Todo App", html: wrap("Todo App", body, script, css) };
}

/* ------------------------------- Stopwatch -------------------------------- */
function stopwatch(): BuiltApp {
  const css = `
  .sw{max-width:380px;margin:48px auto;text-align:center;background:#1f1e1d;border-radius:28px;padding:40px 28px;box-shadow:0 24px 60px rgba(40,30,15,.28)}
  .time{font-size:64px;font-weight:300;color:#fff;font-variant-numeric:tabular-nums;letter-spacing:2px}
  .ms{color:#d97757;font-size:40px}
  .btns{display:flex;gap:12px;justify-content:center;margin-top:30px}
  .btns button{border:0;border-radius:14px;padding:15px 26px;font-size:15px;font-weight:600;cursor:pointer;transition:.12s}
  .btns button:active{transform:scale(.96)}
  .start{background:#d97757;color:#fff}.start.on{background:#56544f}
  .reset{background:#3a3835;color:#fff}`;
  const body = `<div class="wrap"><div class="sw">
  <div class="time"><span id="t">00:00</span><span class="ms" id="ms">.00</span></div>
  <div class="btns"><button class="start" id="go">Start</button><button class="reset" id="reset">Reset</button></div>
  </div></div>`;
  const script = `var start=0,elapsed=0,raf=null,running=false;
  var t=document.getElementById("t"),ms=document.getElementById("ms"),go=document.getElementById("go");
  function fmt(ms2){var m=Math.floor(ms2/60000);var s=Math.floor(ms2%60000/1000);var c=Math.floor(ms2%1000/10);
  return {main:(m<10?"0":"")+m+":"+(s<10?"0":"")+s,cs:"."+(c<10?"0":"")+c};}
  function tick(){elapsed=Date.now()-start;var f=fmt(elapsed);t.textContent=f.main;ms.textContent=f.cs;raf=requestAnimationFrame(tick);}
  go.onclick=function(){if(running){cancelAnimationFrame(raf);running=false;go.textContent="Start";go.className="start";}else{start=Date.now()-elapsed;running=true;go.textContent="Pause";go.className="start on";tick();}};
  document.getElementById("reset").onclick=function(){cancelAnimationFrame(raf);running=false;elapsed=0;go.textContent="Start";go.className="start";t.textContent="00:00";ms.textContent=".00";};`;
  return { title: "Stopwatch", html: wrap("Stopwatch", body, script, css) };
}

/* ------------------------------ Tic Tac Toe ------------------------------- */
function ttt(): BuiltApp {
  const css = `
  .game{max-width:360px;margin:40px auto;text-align:center}
  .status{font-size:20px;margin-bottom:18px;min-height:30px}
  .status.win{color:#d97757;font-weight:700}
  .board{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#d97757;padding:10px;border-radius:18px}
  .cell{aspect-ratio:1;background:#fff;border:0;border-radius:12px;font-size:44px;font-weight:700;cursor:pointer;display:grid;place-items:center;transition:.12s;color:#1f1e1d}
  .cell:hover{background:#faf9f5}.cell.x{color:#d97757}.cell.o{color:#5BA88A}
  .again{margin-top:22px;background:#1f1e1d;color:#fff;border:0;border-radius:12px;padding:12px 26px;font-size:15px;font-weight:600;cursor:pointer}
  .again:hover{background:#3a3835}`;
  const body = `<div class="wrap"><div class="game">
  <div class="status" id="st">Your turn — <b>X</b></div>
  <div class="board" id="b"></div>
  <button class="again" id="again">New game</button>
  </div></div>`;
  const script = `var board=Array(9).fill("");var me="X",ai="O";var over=false;
  var b=document.getElementById("b"),st=document.getElementById("st");
  var wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function draw(){b.innerHTML="";board.forEach(function(v,i){var c=document.createElement("button");c.className="cell "+(v===me?"x":v===ai?"o":"");c.textContent=v;c.onclick=function(){play(i);};b.appendChild(c);});}
  function winner(b2,p){return wins.some(function(w){return w.every(function(i){return b2[i]===p;});});}
  function empty(b2){var r=[];b2.forEach(function(v,i){if(!v)r.push(i);});return r;}
  function status(t,win){st.className=win?"status win":"status";st.innerHTML=t;}
  function play(i){if(over||board[i])return;board[i]=me;end();if(over)return;var m=empty(board)[Math.floor(Math.random()*empty(board).length)];board[m]=ai;end();}
  function end(){draw();if(winner(board,me)){status("🎉 You win!",true);over=true;return;}if(winner(board,ai)){status("Computer (O) wins!",true);over=true;return;}if(!empty(board).length){status("It's a draw!",true);over=true;return;}status("Your turn — <b>X</b>");}
  document.getElementById("again").onclick=function(){board=Array(9).fill("");over=false;end();};
  draw();`;
  return { title: "Tic Tac Toe", html: wrap("Tic Tac Toe", body, script, css) };
}

/* ----------------------------- Color Palette ------------------------------ */
function palette(): BuiltApp {
  const css = `
  .pal{max-width:640px;margin:32px auto}
  .bar{display:flex;height:240px;border-radius:20px;overflow:hidden;box-shadow:0 18px 50px rgba(40,30,15,.14)}
  .sw{flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:16px;color:#fff;font-weight:600;font-size:13px;cursor:pointer;transition:flex .3s}
  .sw:hover{flex:1.4}
  .sw small{opacity:.85;font-weight:500}
  .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
  button{background:#1f1e1d;color:#fff;border:0;border-radius:12px;padding:11px 20px;font-size:14px;font-weight:600;cursor:pointer}`;
  const body = `<div class="wrap"><div class="pal">
  <div class="head"><h1>🎨 Palette</h1><button id="gen">↻ Generate</button></div>
  <div class="bar" id="bar"></div>
  <p style="text-align:center;color:#87867e;margin-top:14px;font-size:13px">Click a swatch to copy its hex</p>
  </div></div>`;
  const script = `var bar=document.getElementById("bar");
  function rnd(n){return Math.floor(Math.random()*n);}
  function hsl(h,s,l){return "hsl("+h+","+s+"%,"+l+"%)";}
  function h2hex(h,s,l){s/=100;l/=100;var k=function(n){return (n+h/30)%12;};var a=s*Math.min(l,1-l);var f=function(n){var c=l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1));return Math.round(255*c).toString(16).padStart(2,"0");};return "#"+f(0)+f(8)+f(4);}
  function gen(){var base=rnd(360);bar.innerHTML="";for(var i=0;i<5;i++){var h=(base+i*28)%360;var s=60+rnd(20);var l=42+i*9;var hex=h2hex(h,s,l).toUpperCase();var d=document.createElement("div");d.className="sw";d.style.background=hsl(h,s,l);d.innerHTML=hex+"<small>"+h+" "+s+" "+l+"</small>";d.onclick=function(){navigator.clipboard&&navigator.clipboard.writeText(hex);d.innerHTML="Copied!";setTimeout(function(){d.innerHTML=hex+"<small>"+h+" "+s+" "+l+"</small>";},700);};bar.appendChild(d);}}
  document.getElementById("gen").onclick=gen;gen();`;
  return { title: "Color Palette", html: wrap("Color Palette", body, script, css) };
}

/* --------------------------- Generic landing page ------------------------- */
function website(topic: string): BuiltApp {
  const t = topic || "Your Brand";
  const css = `
  :root{--c:#d97757}
  nav{display:flex;justify-content:space-between;align-items:center;padding:22px 6%;max-width:1100px;margin:0 auto}
  .logo{font-weight:700;font-size:20px;letter-spacing:-.02em}
  .logo b{color:var(--c)}
  nav a{color:#3d3a33;text-decoration:none;margin-left:26px;font-size:14px;font-weight:500}
  nav a:hover{color:var(--c)}
  .hero{text-align:center;padding:70px 6% 50px;max-width:900px;margin:0 auto}
  .pill{display:inline-block;background:var(--c);color:#fff;font-size:12px;font-weight:600;padding:7px 16px;border-radius:999px;margin-bottom:22px;letter-spacing:.3px}
  h1{font-size:clamp(34px,6vw,58px);line-height:1.05;letter-spacing:-.03em;font-weight:700}
  h1 em{font-style:normal;color:var(--c)}
  .lead{font-size:19px;color:#6f6e69;max-width:560px;margin:22px auto 30px;line-height:1.6}
  .cta{display:inline-flex;gap:12px;justify-content:center;flex-wrap:wrap}
  .btn{background:var(--c);color:#fff;border:0;border-radius:12px;padding:15px 30px;font-size:16px;font-weight:600;cursor:pointer;text-decoration:none}
  .btn.ghost{background:#fff;color:#1f1e1d;box-shadow:inset 0 0 0 1.5px #e5e3da}
  .btn:hover{filter:brightness(.95)}
  .features{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;max-width:1000px;margin:40px auto;padding:0 6%}
  .feat{background:#fff;border:1px solid #ece9df;border-radius:18px;padding:26px}
  .feat .ico{width:46px;height:46px;border-radius:12px;background:var(--c);opacity:.15;display:grid;place-items:center;font-size:22px;margin-bottom:14px}
  .feat h3{font-size:17px;margin-bottom:6px}
  .feat p{color:#6f6e69;font-size:14px;line-height:1.55}
  footer{text-align:center;padding:40px 6%;color:#a8a69d;font-size:13px;border-top:1px solid #ece9df;margin-top:30px}`;
  const body = `<nav><div class="logo">${t}<b>.</b></div><div><a href="#f">Features</a><a href="#">Pricing</a><a href="#">About</a><a href="#" class="btn" style="padding:9px 18px;font-size:14px">Get started</a></div></nav>
  <section class="hero">
    <span class="pill">✦ Now in beta</span>
    <h1>Build something <em>remarkable</em><br>with ${t}</h1>
    <p class="lead">A clean, modern starting point for your idea — beautiful by default, fast everywhere, and ready to make your own. This was generated live by Nexora.</p>
    <div class="cta"><a class="btn" href="#">Get started free</a><a class="btn ghost" href="#">Live demo</a></div>
  </section>
  <section class="features" id="f">
    <div class="feat"><div class="ico">⚡</div><h3>Lightning fast</h3><p>Optimized from the ground up so your visitors never wait.</p></div>
    <div class="feat"><div class="ico">🎨</div><h3>Beautifully designed</h3><p>Polished typography and spacing that feels effortless.</p></div>
    <div class="feat"><div class="ico">📱</div><h3>Fully responsive</h3><p>Looks great on phones, tablets and desktops alike.</p></div>
    <div class="feat"><div class="ico">🔒</div><h3>Secure by default</h3><p>Built with best practices so you can launch with confidence.</p></div>
  </section>
  <footer>© ${new Date().getFullYear()} ${t}. Crafted by Nexora.</footer>`;
  return { title: `${t} — Website`, html: wrap(t, body, "", css) };
}

/* --------------------------------- Notes ---------------------------------- */
function notes(): BuiltApp {
  const css = `
  .notes{max-width:680px;margin:28px auto}
  .addbar{display:flex;gap:8px;margin-bottom:18px}
  .addbar input{flex:1;border:1.5px solid #e5e3da;border-radius:12px;padding:13px 14px;font-size:15px;background:#fff}
  .addbar input:focus{outline:none;border-color:#d97757}
  .addbar button{background:#1f1e1d;color:#fff;border:0;border-radius:12px;padding:0 22px;font-size:15px;font-weight:600;cursor:pointer}
  .addbar button:hover{background:#3a3835}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}
  .note{border-radius:16px;padding:16px;min-height:130px;position:relative;box-shadow:0 6px 18px rgba(40,30,15,.1);transform:rotate(var(--r,0deg))}
  .note p{font-size:15px;line-height:1.5;word-break:break-word}
  .note .del{position:absolute;top:8px;right:8px;background:rgba(0,0,0,.12);border:0;width:24px;height:24px;border-radius:8px;cursor:pointer;font-size:14px;color:#3d3a33;opacity:0;transition:.15s}
  .note:hover .del{opacity:1}`;
  const body = `<div class="wrap"><div class="notes">
  <div class="addbar"><input id="inp" placeholder="Write a note and hit Add…"><button id="add">＋ Add</button></div>
  <div class="grid" id="grid"></div>
  </div></div>`;
  const script = `var data=JSON.parse(localStorage.getItem("notes")||"[]");
  var colors=["#ffe4c4","#cdeec0","#c9e4ff","#f4c9ff","#ffe0e0","#fff3c4","#d4f0e7"];
  var grid=document.getElementById("grid"),inp=document.getElementById("inp");
  function save(){localStorage.setItem("notes",JSON.stringify(data));}
  function render(){grid.innerHTML="";data.forEach(function(n,i){
    var d=document.createElement("div");d.className="note";
    d.style.background=colors[n.c%colors.length];
    d.style.setProperty("--r",(Math.random()*4-2)+"deg");
    var p=document.createElement("p");p.textContent=n.text;d.appendChild(p);
    var x=document.createElement("button");x.className="del";x.textContent="✕";
    x.onclick=function(){data.splice(i,1);save();render();};d.appendChild(x);
    grid.appendChild(d);});}
  function add(){var v=inp.value.trim();if(!v)return;data.unshift({text:v,c:Math.floor(Math.random()*colors.length)});inp.value="";save();render();}
  document.getElementById("add").onclick=add;
  inp.addEventListener("keydown",function(e){if(e.key==="Enter")add();});
  render();`;
  return { title: "Notes App", html: wrap("Notes", body, script, css) };
}

/* ------------------------------- Drawing pad ------------------------------ */
function drawing(): BuiltApp {
  const css = `
  .draw{max-width:720px;margin:28px auto}
  .tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
  .tools .label{font-size:13px;color:#6f6e69;font-weight:600}
  .sw{width:30px;height:30px;border-radius:50%;cursor:pointer;border:3px solid #fff;box-shadow:0 0 0 1.5px #e5e3da}
  .sw.on{box-shadow:0 0 0 2.5px #1f1e1d}
  .tools input[type=range]{width:90px}
  .tools button{background:#1f1e1d;color:#fff;border:0;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer}
  .tools button:hover{background:#3a3835}
  canvas{display:block;width:100%;height:440px;background:#fff;border-radius:18px;box-shadow:0 10px 34px rgba(40,30,15,.14);cursor:crosshair;touch-action:none}`;
  const body = `<div class="wrap"><div class="draw">
  <div class="tools">
    <span class="label">Color</span>
    <span class="sw on" data-c="#1f1e1d" style="background:#1f1e1d"></span>
    <span class="sw" data-c="#d97757" style="background:#d97757"></span>
    <span class="sw" data-c="#5BA88A" style="background:#5BA88A"></span>
    <span class="sw" data-c="#3b82f6" style="background:#3b82f6"></span>
    <span class="sw" data-c="#ef4444" style="background:#ef4444"></span>
    <span class="label">Size</span><input type="range" id="size" min="1" max="40" value="5">
    <button id="clear">Clear</button>
    <button id="save">Save PNG</button>
  </div>
  <canvas id="c"></canvas>
  </div></div>`;
  const script = `var cv=document.getElementById("c"),ctx=cv.getContext("2d");
  function fit(){var r=cv.getBoundingClientRect();cv.width=r.width;cv.height=440;ctx.lineCap="round";ctx.lineJoin="round";ctx.fillStyle="#fff";ctx.fillRect(0,0,cv.width,cv.height);}
  fit();window.addEventListener("resize",fit);
  var color="#1f1e1d",size=5,drawing=false,x=0,y=0;
  document.querySelectorAll(".sw").forEach(function(s){s.onclick=function(){document.querySelectorAll(".sw").forEach(function(o){o.classList.remove("on");});s.classList.add("on");color=s.getAttribute("data-c");};});
  document.getElementById("size").oninput=function(e){size=+e.target.value;};
  function pos(e){var r=cv.getBoundingClientRect();var t=e.touches?e.touches[0]:e;return [t.clientX-r.left,t.clientY-r.top];}
  function start(e){e.preventDefault();drawing=true;var p=pos(e);x=p[0];y=p[1];ctx.beginPath();ctx.moveTo(x,y);}
  function move(e){if(!drawing)return;e.preventDefault();var p=pos(e);ctx.strokeStyle=color;ctx.lineWidth=size;ctx.lineTo(p[0],p[1]);ctx.stroke();x=p[0];y=p[1];}
  function end(){drawing=false;}
  cv.addEventListener("mousedown",start);cv.addEventListener("mousemove",move);window.addEventListener("mouseup",end);
  cv.addEventListener("touchstart",start);cv.addEventListener("touchmove",move);cv.addEventListener("touchend",end);
  document.getElementById("clear").onclick=function(){ctx.fillStyle="#fff";ctx.fillRect(0,0,cv.width,cv.height);};
  document.getElementById("save").onclick=function(){var a=document.createElement("a");a.download="drawing.png";a.href=cv.toDataURL("image/png");a.click();};`;
  return { title: "Drawing Pad", html: wrap("Drawing Pad", body, script, css) };
}

/* --------------------------- Keyword dispatcher --------------------------- */
export function buildApp(prompt: string): BuiltApp | null {
  const p = " " + prompt.toLowerCase() + " ";
  const has = (...w: string[]) => w.every((x) => p.includes(x));

  if (has("calculator") || (p.includes("calc") && !p.includes("calculate"))) return calculator();
  if (has("to-do", "todo", "to do", "task list", "checklist", "task app")) return todo();
  if (has("stopwatch", "stop watch") || (p.includes("timer") && !p.includes("pomodoro"))) return stopwatch();
  if (has("tic", "tic tac", "tictac", "noughts", "xo game")) return ttt();
  if (has("color", "palette", "colour") && (p.includes("palette") || p.includes("generator"))) return palette();
  if (has("note", "notes", "sticky", "memo")) return notes();
  if (has("draw", "drawing", "paint", "sketch", "canvas", "doodle")) return drawing();
  if (has("game") && (p.includes("tic") || p.includes("play"))) return ttt();

  // website / landing / portfolio / page
  if (
    has("website", "web site") ||
    has("landing", "page") ||
    has("portfolio") ||
    has("home page", "homepage") ||
    has("webapp", "web app") ||
    has("site for", "site of")
  ) {
    const topic = extractTopic(prompt);
    return website(topic);
  }

  return null;
}

/** Always returns a buildable app: a known template if matched, else a
 *  polished website about the topic so *anything* can be previewed live. */
export function buildAnything(prompt: string): BuiltApp {
  return buildApp(prompt) ?? website(extractTopic(prompt));
}

function extractTopic(prompt: string): string {
  let t = prompt
    .replace(/.*\b(build|make|create|design|develop|code|generate|banao|bana)\b/i, "")
    .replace(/\b(a|an|the|me|my|our|us|own|please|simple|nice|cool|app|application)\b/gi, "")
    .replace(/\b(website|webapp|web app|site|landing page|page|portfolio|homepage|home page|for|about|ka|ki|ne|se|ko)\b/gi, "")
    .replace(/[?.!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "Your Brand";
  return t.split(" ").slice(0, 3).join(" ").replace(/\b\w/g, (c) => c.toUpperCase());
}
