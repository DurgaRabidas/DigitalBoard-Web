/* global pdfjsLib, fabric, jspdf, katex */
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const $ = (id) => document.getElementById(id);
const pdfCanvas = $('pdfCanvas');
const pdfCtx = pdfCanvas.getContext('2d');
const fabricCanvas = new fabric.Canvas('fabricCanvas', { preserveObjectStacking: true, fireRightClick: true, stopContextMenu: true, selection: true });
const state = { pages: [], current: -1, pdf: null, tool: 'select', color: '#0f172a', brush: 5, zoom: 1, busy: false, equationMode: false, history: {}, redo: {}, suppress: false };
const DEFAULT = { width: 1240, height: 1754, blank: true };

const controls = ['pdfInput','addBlankBtn','duplicatePageBtn','deletePageBtn','exportBtn','prevBtn','nextBtn','zoomOutBtn','zoomInBtn','fitBtn','resetZoomBtn','undoBtn','redoBtn','clearBtn','shapeSelect','textBtn','equationBtn','imageBtn','imageInput','colorPicker','brushSize','brushSizeOut','pageStatus','zoomStatus','thumbList','stage'];
const el = Object.fromEntries(controls.map(id => [id, $(id)]));

function makePage(meta){ return { id: crypto.randomUUID(), width: meta.width, height: meta.height, pdfPage: meta.pdfPage || null, blank: !!meta.blank, bg: meta.bg || null, json: null }; }
function page(){ return state.pages[state.current]; }
function setStatus(){ el.pageStatus.textContent = state.pages.length ? `Page ${state.current + 1} / ${state.pages.length}` : 'Page 0 / 0'; el.zoomStatus.textContent = `${Math.round(state.zoom*100)}%`; }
function savePage(){ if (state.current < 0 || state.suppress) return; page().json = JSON.stringify(fabricCanvas.toDatalessJSON(['kind','latex'])); }
function snapshot(){ if (state.current < 0 || state.suppress) return; savePage(); const id = page().id; state.history[id] ||= []; state.redo[id] = []; state.history[id].push(page().json); if (state.history[id].length > 80) state.history[id].shift(); renderThumb(state.current); }
function restoreJson(json){ state.suppress = true; fabricCanvas.clear(); fabricCanvas.loadFromJSON(json || '{}', () => { fabricCanvas.renderAll(); state.suppress = false; }); }

async function showPage(index){
  if (index < 0 || index >= state.pages.length) return;
  savePage(); state.current = index; const p = page(); pdfCanvas.width = p.width; pdfCanvas.height = p.height; fabricCanvas.setWidth(p.width); fabricCanvas.setHeight(p.height); el.stage.style.width = `${p.width}px`; el.stage.style.height = `${p.height}px`;
  await drawBackground(p); restoreJson(p.json); state.history[p.id] ||= [p.json || JSON.stringify({objects:[]})]; fitToScreen(false); setStatus(); buildThumbs();
}
async function drawBackground(p){
  pdfCtx.save(); pdfCtx.setTransform(1,0,0,1,0,0); pdfCtx.clearRect(0,0,pdfCanvas.width,pdfCanvas.height); pdfCtx.fillStyle='white'; pdfCtx.fillRect(0,0,p.width,p.height);
  if (p.pdfPage){ const viewport = p.pdfPage.getViewport({ scale: p.width / p.pdfPage.getViewport({scale:1}).width }); await p.pdfPage.render({ canvasContext: pdfCtx, viewport }).promise; }
  if (p.bg){ const img = await loadImage(p.bg); pdfCtx.drawImage(img,0,0,p.width,p.height); }
  pdfCtx.restore();
}
function loadImage(src){ return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src; }); }

el.pdfInput.addEventListener('change', async e => {
  const file = e.target.files[0]; if(!file) return; state.busy = true; const data = await file.arrayBuffer(); state.pdf = await pdfjsLib.getDocument({ data }).promise; state.pages = [];
  for(let i=1;i<=state.pdf.numPages;i++){ const pdfPage = await state.pdf.getPage(i); const vp = pdfPage.getViewport({scale:2}); state.pages.push(makePage({width:Math.round(vp.width), height:Math.round(vp.height), pdfPage})); }
  state.history = {}; state.redo = {}; await showPage(0); state.busy = false;
});

function addBlank(after = state.current){ const base = page() || DEFAULT; state.pages.splice(after + 1, 0, makePage({ width: base.width, height: base.height, blank:true })); showPage(after + 1); }
el.addBlankBtn.onclick = () => addBlank();
el.duplicatePageBtn.onclick = () => { if(!page()) return; savePage(); const p = page(); state.pages.splice(state.current+1,0,{...makePage(p), json:p.json, bg:p.bg, pdfPage:p.pdfPage, blank:p.blank}); showPage(state.current+1); };
el.deletePageBtn.onclick = () => { if(!page()) return; state.pages.splice(state.current,1); if(!state.pages.length){ fabricCanvas.clear(); pdfCtx.clearRect(0,0,pdfCanvas.width,pdfCanvas.height); state.current=-1; buildThumbs(); setStatus(); return; } showPage(Math.max(0,state.current-1)); };
el.prevBtn.onclick = () => showPage(state.current-1); el.nextBtn.onclick = () => showPage(state.current+1);

function setTool(t){ state.tool=t; document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t)); fabricCanvas.isDrawingMode = ['pen','pencil','highlighter','eraser'].includes(t); fabricCanvas.selection = t==='select'; fabricCanvas.defaultCursor = t==='select'?'grab':'crosshair'; fabricCanvas.forEachObject(o=>o.selectable=t==='select'); setupBrush(); }
function setupBrush(){ const c = new fabric.PencilBrush(fabricCanvas); c.width = +el.brushSize.value; c.color = state.tool==='highlighter' ? hexToRgba(state.color,.35) : state.color; fabricCanvas.freeDrawingBrush = c; }
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
el.colorPicker.oninput = e => { state.color=e.target.value; setupBrush(); }; el.brushSize.oninput = e => { el.brushSizeOut.value=e.target.value; setupBrush(); };
fabricCanvas.on('path:created', e => { if(state.tool==='highlighter') e.path.globalCompositeOperation='multiply'; if(state.tool==='eraser'){ e.path.stroke='white'; e.path.strokeWidth=+el.brushSize.value*2; } snapshot(); });
fabricCanvas.on('object:modified', snapshot); fabricCanvas.on('object:added', () => { if(!state.suppress) savePage(); });

el.clearBtn.onclick = () => { fabricCanvas.getObjects().forEach(o=>fabricCanvas.remove(o)); snapshot(); };
el.undoBtn.onclick = () => historyMove(-1); el.redoBtn.onclick = () => historyMove(1);
function historyMove(dir){ if(!page())return; const id=page().id; state.history[id] ||= [page().json]; state.redo[id] ||= []; if(dir<0 && state.history[id].length>1){ state.redo[id].push(state.history[id].pop()); page().json=state.history[id].at(-1); restoreJson(page().json); } if(dir>0 && state.redo[id].length){ const j=state.redo[id].pop(); state.history[id].push(j); page().json=j; restoreJson(j); } }

el.shapeSelect.onchange = e => { if(!e.target.value)return; addShape(e.target.value); e.target.value=''; };
function addShape(type){ const opt={left:120,top:120,stroke:state.color,fill:'rgba(255,255,255,0)',strokeWidth:+el.brushSize.value,selectable:true}; let o; if(type==='line') o=new fabric.Line([80,80,320,80],opt); if(type==='arrow') o=arrow(); if(type==='rect') o=new fabric.Rect({...opt,width:220,height:130}); if(type==='roundRect') o=new fabric.Rect({...opt,width:220,height:130,rx:22,ry:22}); if(type==='circle') o=new fabric.Circle({...opt,radius:80}); if(type==='ellipse') o=new fabric.Ellipse({...opt,rx:110,ry:70}); if(type==='triangle') o=new fabric.Triangle({...opt,width:190,height:160}); if(type==='rightTriangle') o=new fabric.Polygon([{x:0,y:0},{x:0,y:170},{x:230,y:170}],opt); if(type==='polygon') o=new fabric.Polygon(poly(6,95),opt); if(type==='star') o=new fabric.Polygon(star(5,100,45),opt); if(type==='arc') o=new fabric.Path('M 20 140 Q 120 10 240 140',opt); if(type==='axes') o=axes(); fabricCanvas.add(o).setActiveObject(o); snapshot(); setTool('select'); }
function arrow(){ return new fabric.Group([new fabric.Line([0,0,230,0],{stroke:state.color,strokeWidth:+el.brushSize.value}),new fabric.Triangle({left:230,top:0,originX:'center',originY:'center',angle:90,width:22,height:28,fill:state.color})],{left:120,top:120}); }
function poly(n,r){return Array.from({length:n},(_,i)=>({x:Math.cos(i*2*Math.PI/n)*r+r,y:Math.sin(i*2*Math.PI/n)*r+r}));}
function star(n,or,ir){let a=[];for(let i=0;i<n*2;i++){let r=i%2?ir:or;a.push({x:Math.cos(i*Math.PI/n-Math.PI/2)*r+or,y:Math.sin(i*Math.PI/n-Math.PI/2)*r+or});}return a;}
function axes(){ const g=[]; for(let i=0;i<=400;i+=40){g.push(new fabric.Line([i,0,i,400],{stroke:'#bfdbfe'}),new fabric.Line([0,i,400,i],{stroke:'#bfdbfe'}));} g.push(new fabric.Line([200,0,200,400],{stroke:state.color,strokeWidth:3}),new fabric.Line([0,200,400,200],{stroke:state.color,strokeWidth:3})); return new fabric.Group(g,{left:90,top:90}); }

el.textBtn.onclick=()=>openText(false); el.equationBtn.onclick=()=>openText(true); el.symbolsBtn.onclick=()=>{ $('textValue').value+=' ∑ ∫ √ π θ α β ≤ ≥ ≠ ± × ÷ ² ³ ₁ ₂ '; openText(false); };
function openText(eq){ state.equationMode=eq; $('dialogTitle').textContent=eq?'Add Equation':'Add Text'; $('textDialog').showModal(); }
el.insertTextBtn.onclick = () => { const text=$('textValue').value.trim(); if(!text)return; const color=$('textColor').value; const size=+$('fontSize').value; let obj; if(state.equationMode){ const html=katex.renderToString(text,{throwOnError:false,displayMode:false}); obj=new fabric.Textbox(strip(html)||text,{left:130,top:130,fontSize:size,fill:color,kind:'equation',latex:text,width:420}); } else obj=new fabric.Textbox(text,{left:130,top:130,width:420,fontSize:size,fill:color,fontWeight:$('boldText').checked?'700':'400',fontStyle:$('italicText').checked?'italic':'normal'}); fabricCanvas.add(obj).setActiveObject(obj); $('textValue').value=''; snapshot(); };
function strip(html){ const d=document.createElement('div'); d.innerHTML=html; return d.textContent; }
el.imageBtn.onclick=()=>el.imageInput.click(); el.imageInput.onchange=e=>{ const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>fabric.Image.fromURL(ev.target.result,img=>{ img.scaleToWidth(Math.min(400,page().width*.4)); fabricCanvas.add(img).setActiveObject(img); snapshot(); }); r.readAsDataURL(f); };
el.rulerBtn.onclick=()=>{ fabricCanvas.add(new fabric.Rect({left:140,top:180,width:520,height:52,fill:'rgba(250,204,21,.35)',stroke:'#92400e',strokeWidth:2,angle:-6,kind:'ruler'})); snapshot(); };
el.protractorBtn.onclick=()=>{ fabricCanvas.add(new fabric.Path('M 0 180 A 180 180 0 0 1 360 180 L 180 180 Z',{left:140,top:140,fill:'rgba(59,130,246,.15)',stroke:'#1d4ed8',strokeWidth:3,kind:'protractor'})); snapshot(); };
el.compassBtn.onclick=()=>addShape('circle'); el.gridBtn.onclick=()=>addShape('axes');

function applyZoom(){ el.stage.style.transform=`scale(${state.zoom})`; setStatus(); }
function fitToScreen(update=true){ if(!page())return; const parent=el.stage.parentElement.getBoundingClientRect(); state.zoom=Math.min((parent.width-30)/page().width,(parent.height-30)/page().height,1); applyZoom(); if(update) savePage(); }
el.zoomInBtn.onclick=()=>{state.zoom=Math.min(4,state.zoom+.1);applyZoom();}; el.zoomOutBtn.onclick=()=>{state.zoom=Math.max(.15,state.zoom-.1);applyZoom();}; el.resetZoomBtn.onclick=()=>{state.zoom=1;applyZoom();}; el.fitBtn.onclick=()=>fitToScreen();

async function renderThumb(i){ const p=state.pages[i]; if(!p) return; const cnv=document.createElement('canvas'); cnv.width=160; cnv.height=Math.round(160*p.height/p.width); const c=cnv.getContext('2d'); c.fillStyle='white'; c.fillRect(0,0,cnv.width,cnv.height); if(i===state.current) c.drawImage(pdfCanvas,0,0,cnv.width,cnv.height); p.thumb=cnv.toDataURL('image/jpeg',.75); }
function blankThumb(p){ const cnv=document.createElement('canvas'); cnv.width=160; cnv.height=Math.round(160*p.height/p.width); const c=cnv.getContext('2d'); c.fillStyle='white'; c.fillRect(0,0,cnv.width,cnv.height); c.strokeStyle='#cbd5e1'; c.strokeRect(0,0,cnv.width,cnv.height); return cnv.toDataURL('image/png'); }
function buildThumbs(){ el.thumbList.innerHTML=''; state.pages.forEach((p,i)=>{ const d=document.createElement('div'); d.className=`thumb ${i===state.current?'active':''}`; d.draggable=true; d.innerHTML=`<div class="thumb-paper"><img src="${p.thumb||blankThumb(p)}" alt="Page ${i+1}"></div><div class="thumb-footer"><span>${i+1}</span><button data-insert="${i}">+ after</button></div>`; d.onclick=ev=>{ if(ev.target.dataset.insert){ addBlank(+ev.target.dataset.insert); return; } showPage(i); }; d.ondragstart=ev=>ev.dataTransfer.setData('text/plain',i); d.ondragover=ev=>ev.preventDefault(); d.ondrop=ev=>{ ev.preventDefault(); const from=+ev.dataTransfer.getData('text/plain'); const [m]=state.pages.splice(from,1); state.pages.splice(i,0,m); showPage(i); }; el.thumbList.appendChild(d); }); }

el.exportBtn.onclick = async () => { if(!state.pages.length) return alert('Import a PDF or add a blank page first.'); savePage(); const { jsPDF } = jspdf; const doc = new jsPDF({unit:'pt',format:[page().width,page().height]}); for(let i=0;i<state.pages.length;i++){ const p=state.pages[i]; if(i) doc.addPage([p.width,p.height], p.width>p.height?'landscape':'portrait'); await showPage(i); const img=el.stageToImage ? null : composePage(); doc.addImage(img,'PNG',0,0,p.width,p.height); } doc.save('teaching-board-export.pdf'); };
function composePage(){ const out=document.createElement('canvas'); out.width=page().width; out.height=page().height; const c=out.getContext('2d'); c.drawImage(pdfCanvas,0,0); c.drawImage(fabricCanvas.lowerCanvasEl,0,0); return out.toDataURL('image/png'); }
function hexToRgba(hex,a){ const n=parseInt(hex.slice(1),16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; }
window.addEventListener('resize',()=>fitToScreen(false)); setTool('select'); addBlank(-1);
