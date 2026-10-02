// ============================================================
// PC MARKET — script.js
// Menú móvil · buscador · filtros · orden · carrito de compras
// ============================================================

// Número de WhatsApp de la tienda (código de país + número, sin + ni espacios).
// Ej. El Salvador: "50370001234". Si lo dejas vacío, el pedido se confirma en pantalla.
const WHATSAPP_TIENDA = "";
const MAX_POR_PRODUCTO = 10;

document.addEventListener("DOMContentLoaded", () => {

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
    const normalizar = (t) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const dinero = (n) => "$" + n.toFixed(2);
    const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));


    // ========================================================
    // MENÚ MÓVIL
    // ========================================================
    const botonMenu = $("#navToggle");
    const menu = $("#navPrincipal");

    if (botonMenu && menu) {
        const cerrarMenu = () => {
            menu.classList.remove("esta-abierto");
            botonMenu.setAttribute("aria-expanded", "false");
        };
        botonMenu.addEventListener("click", () => {
            const abierto = menu.classList.toggle("esta-abierto");
            botonMenu.setAttribute("aria-expanded", abierto ? "true" : "false");
        });
        $$("a", menu).forEach((a) => a.addEventListener("click", cerrarMenu));
    }


    // ========================================================
    // CATÁLOGO: buscador + filtros + orden
    // ========================================================
    const grid = $("#productosGrid");
    const productos = $$(".producto");
    const filtros = $$(".filtro");
    const buscador = $("#buscador");
    const sinResultados = $("#sinResultados");
    let categoriaActual = "todos";
    let orden = "";

    // Datos de cada producto leídos del HTML
    const catalogo = productos.map((el, i) => {
        const id = "p" + (i + 1);
        el.dataset.id = id;
        return {
            id,
            el,
            nombre: $("h2", el).textContent.trim(),
            marca: $(".producto__marca", el).textContent.trim(),
            precio: parseFloat($(".producto__precio", el).textContent.replace(/[^0-9.]/g, "")),
            img: $("img", el) ? $("img", el).getAttribute("src") : "",
            texto: normalizar(el.textContent),
            tokens: [...new Set(normalizar(el.textContent).split(/[^a-z0-9]+/).filter(Boolean))],
        };
    });
    const porId = (id) => catalogo.find((p) => p.id === id);

    // ----- Búsqueda inteligente: sinónimos, plurales y errores de escritura -----
    const GRUPOS = [
        ["audifono", "auricular", "headset", "headphone", "casco"],
        ["mouse", "raton"],
        ["teclado", "keyboard"],
        ["camara", "webcam", "streaming", "videollamada"],
        ["grafica", "tarjeta", "video", "gpu", "nvidia", "geforce", "radeon", "rtx", "gtx"],
        ["procesador", "cpu", "ryzen", "core"],
        ["memoria", "ram", "ddr4", "ddr5"],
        ["ssd", "nvme", "disco", "almacenamiento", "hdd", "unidad"],
        ["gabinete", "case", "caja", "torre", "chasis"],
        ["mousepad", "alfombrilla", "pad"],
        ["gamer", "gaming", "juego", "jugar"],
        ["barato", "economico", "basico", "entrada"],
        ["rgb", "luces", "iluminacion"],
    ];
    const INDICE = new Map();
    GRUPOS.forEach((g) => g.forEach((t) => INDICE.set(t, g)));
    const IGNORAR = new Set(["de", "del", "la", "el", "los", "las", "para", "con", "un", "una", "y", "en", "mi", "que"]);

    function palabrasBusqueda() {
        return normalizar(buscador ? buscador.value : "").split(/\s+/).filter((w) => w && !IGNORAR.has(w));
    }

    function expandir(w) {
        const formas = [...new Set([w, w.replace(/s$/, ""), w.replace(/es$/, "")])].filter((f) => f.length >= 2);
        const salida = new Set(formas);
        formas.forEach((f) => (INDICE.get(f) || []).forEach((t) => salida.add(t)));
        return [...salida];
    }

    function distancia(a, b) {
        if (Math.abs(a.length - b.length) > 2) return 9;
        let prev = [...Array(b.length + 1).keys()];
        for (let i = 1; i <= a.length; i++) {
            const cur = [i];
            for (let j = 1; j <= b.length; j++) {
                cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            }
            prev = cur;
        }
        return prev[b.length];
    }

    function coincide(p, palabras) {
        return palabras.every((w) => {
            const terminos = expandir(w);
            const directo = terminos.some((t) =>
                t.length >= 5 ? p.texto.includes(t) : p.tokens.some((k) => k.startsWith(t)));
            if (directo) return true;
            if (w.length < 4 || !/^[a-z]+$/.test(w)) return false;      // errores de escritura (solo letras)
            const tol = w.length >= 7 ? 2 : 1;
            return p.tokens.some((k) => distancia(w, k) <= tol || distancia(w, k.slice(0, w.length)) <= tol);
        });
    }

    function mostrarProductos() {
        const palabras = palabrasBusqueda();
        let encontrados = 0;

        catalogo.forEach((p) => {
            const okCategoria = categoriaActual === "todos" || p.el.dataset.categoria === categoriaActual;
            const okBusqueda = coincide(p, palabras);
            const visible = okCategoria && okBusqueda;
            p.el.style.display = visible ? "" : "none";
            if (visible) encontrados++;
        });

        // Ordenar (reordena los nodos dentro del grid)
        if (grid && orden) {
            const lista = [...catalogo];
            if (orden === "menor") lista.sort((a, b) => a.precio - b.precio);
            if (orden === "mayor") lista.sort((a, b) => b.precio - a.precio);
            if (orden === "nombre") lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
            lista.forEach((p) => grid.appendChild(p.el));
        }

        if (sinResultados) {
            sinResultados.hidden = encontrados !== 0;
            if (encontrados === 0) {
                sinResultados.textContent = "No encontramos resultados para «" + (buscador ? buscador.value.trim() : "") +
                    "». Prueba con otra palabra: mouse, audífonos, SSD, gabinete…";
            }
        }
    }

    function activarCategoria(cat) {
        categoriaActual = cat;
        filtros.forEach((f) => f.classList.toggle("activo", f.dataset.categoria === cat));
        mostrarProductos();
    }

    if (grid) {
        // Contador por categoría en cada filtro
        filtros.forEach((f) => {
            const k = f.dataset.categoria;
            const n = k === "todos" ? catalogo.length : catalogo.filter((p) => p.el.dataset.categoria === k).length;
            f.insertAdjacentHTML("beforeend", `<small>${n}</small>`);
            f.addEventListener("click", () => activarCategoria(k));
        });

        if (buscador) buscador.addEventListener("input", mostrarProductos);

        // Selector de orden (se agrega solo, no hace falta tocar el HTML)
        const cajaBusqueda = $(".catalogo__busqueda");
        if (cajaBusqueda) {
            const sel = document.createElement("select");
            sel.id = "ordenar";
            sel.setAttribute("aria-label", "Ordenar productos");
            sel.innerHTML = `
                <option value="">Ordenar: destacados</option>
                <option value="menor">Precio: menor a mayor</option>
                <option value="mayor">Precio: mayor a menor</option>
                <option value="nombre">Nombre: A–Z</option>`;
            sel.addEventListener("change", () => { orden = sel.value; mostrarProductos(); });
            cajaBusqueda.appendChild(sel);
        }

        // Sugerencias mientras se escribe
        if (cajaBusqueda && buscador) {
            buscador.type = "search";
            buscador.autocomplete = "off";
            buscador.placeholder = "Buscar: mouse, audífonos, SSD, RTX...";
            const lista = document.createElement("ul");
            lista.className = "sugerencias";
            lista.hidden = true;
            cajaBusqueda.appendChild(lista);
            const ocultar = () => { lista.hidden = true; };

            function sugerir() {
                const q = palabrasBusqueda();
                const coinc = q.length ? catalogo.filter((p) => coincide(p, q)).slice(0, 5) : [];
                if (!coinc.length) return ocultar();
                lista.innerHTML = coinc.map((p) =>
                    `<li><button type="button" data-id="${p.id}"><span>${esc(p.nombre)}</span><small>${esc(p.marca)} · ${dinero(p.precio)}</small></button></li>`).join("");
                lista.hidden = false;
            }
            buscador.addEventListener("input", sugerir);
            buscador.addEventListener("focus", sugerir);
            buscador.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === "Escape") ocultar(); });
            lista.addEventListener("click", (e) => {
                const b = e.target.closest("button");
                if (!b) return;
                buscador.value = porId(b.dataset.id).nombre;
                ocultar();
                activarCategoria("todos");
            });
            document.addEventListener("click", (e) => { if (!cajaBusqueda.contains(e.target)) ocultar(); });
        }

        // Entrar desde categorias.html (?categoria=graficas)
        const param = new URLSearchParams(location.search).get("categoria");
        if (param && filtros.some((f) => f.dataset.categoria === param)) activarCategoria(param);
        else mostrarProductos();
    }


    // ========================================================
    // CARRITO
    // ========================================================
    let carrito = [];                       // [{ id, nombre, precio, img, cant }]
    const CLAVE = "pcmarket_carrito";

    try { carrito = JSON.parse(localStorage.getItem(CLAVE)) || []; } catch (e) { carrito = []; }
    const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(carrito)); } catch (e) {} };

    // --- Botón del carrito en el menú ---
    const barra = $(".topbar__inner");
    const botonCarrito = document.createElement("button");
    botonCarrito.type = "button";
    botonCarrito.className = "carrito-btn";
    botonCarrito.setAttribute("aria-label", "Abrir carrito");
    botonCarrito.innerHTML = `<span aria-hidden="true">🛒</span><span class="carrito-btn__cont" id="carritoCont">0</span>`;
    if (barra) barra.appendChild(botonCarrito);

    // --- Panel lateral ---
    const fondo = document.createElement("div");
    fondo.className = "carrito-fondo";
    const panel = document.createElement("aside");
    panel.className = "carrito";
    panel.setAttribute("aria-label", "Carrito de compras");
    panel.innerHTML = `
        <div class="carrito__cabeza">
            <h2>Tu carrito</h2>
            <button type="button" class="carrito__cerrar" aria-label="Cerrar carrito">✕</button>
        </div>
        <div class="carrito__lista" id="carritoLista"></div>
        <div class="carrito__pie" id="carritoPie"></div>`;
    document.body.append(fondo, panel);

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
    let temporizador;
    function avisar(msg) {
        toast.textContent = msg;
        toast.classList.add("visible");
        clearTimeout(temporizador);
        temporizador = setTimeout(() => toast.classList.remove("visible"), 1800);
    }

    function abrir() { panel.classList.add("abierto"); fondo.classList.add("abierto"); document.body.classList.add("sin-scroll"); }
    function cerrar() { panel.classList.remove("abierto"); fondo.classList.remove("abierto"); document.body.classList.remove("sin-scroll"); }
    botonCarrito.addEventListener("click", abrir);
    fondo.addEventListener("click", cerrar);
    $(".carrito__cerrar", panel).addEventListener("click", cerrar);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(); });

    // --- Lógica ---
    function agregar(id) {
        const p = porId(id);
        if (!p) return;
        const linea = carrito.find((l) => l.id === id);
        if (linea) {
            if (linea.cant >= MAX_POR_PRODUCTO) return avisar("Máximo " + MAX_POR_PRODUCTO + " por producto");
            linea.cant++;
        } else {
            carrito.push({ id, nombre: p.nombre, precio: p.precio, img: p.img, cant: 1 });
        }
        guardar(); pintar();
        avisar("✔ " + p.nombre + " agregado");
    }

    function cambiarCantidad(id, delta) {
        const linea = carrito.find((l) => l.id === id);
        if (!linea) return;
        linea.cant = Math.min(MAX_POR_PRODUCTO, linea.cant + delta);
        if (linea.cant <= 0) carrito = carrito.filter((l) => l.id !== id);
        guardar(); pintar();
    }

    const total = () => carrito.reduce((s, l) => s + l.precio * l.cant, 0);
    const cantidadTotal = () => carrito.reduce((s, l) => s + l.cant, 0);

    function pintar() {
        const lista = $("#carritoLista");
        const pie = $("#carritoPie");
        const cont = $("#carritoCont");
        const n = cantidadTotal();
        cont.textContent = n;
        cont.classList.toggle("vacio", n === 0);

        if (!carrito.length) {
            lista.innerHTML = `<p class="carrito__vacio">Tu carrito está vacío.<br>Agrega productos desde el catálogo.</p>`;
            pie.innerHTML = `<a href="index.html" class="boton boton--primario">Ver catálogo</a>`;
            return;
        }

        lista.innerHTML = carrito.map((l) => `
            <div class="item" data-id="${l.id}">
                <img src="${esc(l.img)}" alt="">
                <div class="item__info">
                    <strong>${esc(l.nombre)}</strong>
                    <span>${dinero(l.precio)}</span>
                    <div class="item__cant">
                        <button type="button" data-accion="menos" aria-label="Quitar uno">−</button>
                        <b>${l.cant}</b>
                        <button type="button" data-accion="mas" aria-label="Agregar uno">+</button>
                    </div>
                </div>
                <div class="item__lado">
                    <strong>${dinero(l.precio * l.cant)}</strong>
                    <button type="button" data-accion="quitar" class="item__quitar">Quitar</button>
                </div>
            </div>`).join("");

        pie.innerHTML = `
            <div class="carrito__total"><span>Total</span><strong>${dinero(total())}</strong></div>
            <button type="button" class="boton boton--primario" data-accion="comprar">Finalizar compra</button>
            <button type="button" class="carrito__vaciar" data-accion="vaciar">Vaciar carrito</button>`;
    }

    // Clics dentro del panel
    panel.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-accion]");
        if (!btn) return;
        const accion = btn.dataset.accion;
        const item = btn.closest(".item");
        const id = item ? item.dataset.id : null;

        if (accion === "mas") cambiarCantidad(id, 1);
        if (accion === "menos") cambiarCantidad(id, -1);
        if (accion === "quitar") { carrito = carrito.filter((l) => l.id !== id); guardar(); pintar(); }
        if (accion === "vaciar") { carrito = []; guardar(); pintar(); }
        if (accion === "comprar") finalizar();
    });

    function finalizar() {
        const detalle = carrito.map((l) => `• ${l.cant} x ${l.nombre} — ${dinero(l.precio * l.cant)}`).join("\n");
        const mensaje = `Hola PC Market, quiero hacer este pedido:\n${detalle}\n\nTotal: ${dinero(total())}`;
        const resumen = carrito.map((l) => `<li>${l.cant} × ${esc(l.nombre)}</li>`).join("");
        const totalFinal = dinero(total());

        if (WHATSAPP_TIENDA) {
            window.open("https://wa.me/" + WHATSAPP_TIENDA + "?text=" + encodeURIComponent(mensaje), "_blank", "noopener");
        }

        $("#carritoLista").innerHTML = `
            <div class="carrito__ok">
                <div class="carrito__ok-icono">✔</div>
                <h3>¡Gracias por tu compra!</h3>
                <p>Registramos tu pedido por <strong>${totalFinal}</strong>.<br>Te contactaremos para confirmar la entrega.</p>
                <ul>${resumen}</ul>
            </div>`;
        $("#carritoPie").innerHTML = `<button type="button" class="boton boton--primario" data-accion="cerrar-ok">Seguir comprando</button>`;
        carrito = []; guardar();
        $("#carritoCont").textContent = "0";
        $("#carritoCont").classList.add("vacio");
    }
    panel.addEventListener("click", (e) => {
        if (e.target.closest("[data-accion='cerrar-ok']")) { cerrar(); pintar(); }
    });

    // --- Botón "Agregar" en cada tarjeta del catálogo ---
    catalogo.forEach((p) => {
        const abajo = $(".producto__abajo", p.el);
        if (!abajo) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "boton boton--primario producto__agregar";
        b.textContent = "Agregar al carrito";
        b.addEventListener("click", () => agregar(p.id));
        abajo.after(b);
    });

    pintar();

});