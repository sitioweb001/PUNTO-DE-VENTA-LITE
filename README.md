# 🚀 ERP POS LITE v3.5

Un sistema de Punto de Venta (POS) y Gestión de Inventario ligero, rápido y optimizado para dispositivos móviles y de escritorio. Está construido con tecnologías web estándar en el frontend (HTML, CSS, JS) y utiliza **Google Apps Script (Google Sheets)** como base de datos en la nube.

---

## 📑 Índice
1. [Características Principales](#-características-principales)
2. [Estructura de Archivos](#-estructura-de-archivos)
3. [Módulos del Sistema](#-módulos-del-sistema)
4. [Guía de Uso Rápido](#-guía-de-uso-rápido)
5. [Instalación y Despliegue](#-instalación-y-despliegue)
6. [Flujo de Datos (Cómo funciona)](#-flujo-de-datos-cómo-funciona)

---

## ✨ Características Principales

* **Lector de Código de Barras Integrado:** Usa la cámara del dispositivo móvil o PC para escanear y auto-sumar productos.
* **Auto-Login:** Acceso rápido con doble clic en la pantalla de inicio.
* **Cálculo de Vuelto/Cambio:** Automático en tiempo real al ingresar el efectivo del cliente.
* **Diseño Responsivo y Dark Mode:** Adaptable a pantallas pequeñas sin que las notificaciones tapen el menú principal.
* **Feedback Visual Inmediato:** Parpadeo verde de éxito (`flash-success`) y notificaciones flotantes superiores.
* **Backend Serverless:** Sin costos de hosting, los datos se guardan directamente en tu cuenta de Google Sheets.

---

## 📁 Estructura de Archivos

El sistema está dividido en 4 archivos principales, separando claramente la lógica, el diseño y el servidor.

| Archivo | Tipo | Descripción |
| :--- | :--- | :--- |
| `Nindex.html` | Estructura | Contiene todo el esqueleto web de la aplicación, formularios, modales y el contenedor del escáner de cámara. |
| `Nestilo.css` | Apariencia | Hoja de estilos. Incluye las variables de color, *Dark Mode*, animaciones de parpadeo verde y el diseño responsivo (móvil/desktop). |
| `Nscript.js` | Lógica Cliente | Archivo principal del Frontend. Maneja el carrito, las sumas, encendido de cámara (`html5-qrcode`), atajos y comunicación con el servidor. |
| `Nsg.js` | Lógica Servidor | Código para **Google Apps Script**. Recibe las peticiones de la web y escribe/lee la base de datos en Google Sheets. |

---

## 📦 Módulos del Sistema

| Módulo | Funcionalidad |
| :--- | :--- |
| 🛒 **Punto de Venta (POS)** | Búsqueda por nombre o escáner de cámara. Auto-suma al detectar coincidencia exacta. Calculadora de pago y cambio. |
| 📦 **Inventario** | Visualización general del stock, precios de compra/venta y códigos. Buscador en tiempo real. |
| ➕ **Reg. Producto** | Formulario para ingresar nuevos artículos. Permite usar la cámara para escanear y rellenar el código de barras rápidamente. |
| 🏷️ **Categorías** | Creación y listado rápido de categorías para organizar el inventario. |
| 🚚 **Compras** | Registro de entrada de mercadería. Suma automáticamente la cantidad comprada al stock actual del producto. |
| 📊 **Reportes** | Filtro de ventas por día (Hoy), semana o mes. Muestra el total recaudado y el historial de tickets. |
| 🗑️ **Papelera** | Historial de productos eliminados. Permite restaurar elementos borrados por error al inventario activo. |
| 📥 **Importador** | Interfaz preparada para cargar catálogos masivos mediante archivos `.csv` o `.json`. |
| 🛠️ **Ajustes** | Control del Modo Oscuro/Claro y botón para inicializar/conectar la Base de Datos en Google Sheets. |

---

## ⚡ Guía de Uso Rápido

### Atajo de Inicio de Sesión
En la pantalla de Login, haz **doble clic sobre la tarjeta blanca** para que el sistema rellene automáticamente las credenciales (`admin` / `admin123`) y te dé acceso instantáneo.

### Uso del Escáner (Cámara)
1. Ve al módulo **Punto de Venta**.
2. Haz clic en el botón con el ícono de la **Cámara** junto al buscador.
3. Apunta al código de barras del producto.
4. Si el código está registrado, el sistema hará un *parpadeo verde*, cerrará la cámara y sumará **+1** al carrito de manera automática.

### Cobro y Cambio
En el POS, una vez tengas productos en el carrito:
1. Revisa el monto total.
2. En la casilla **"Efectivo Cliente Paga con ($):"**, escribe cuánto dinero te entregó el cliente.
3. La casilla de abajo **(roja)** te dirá automáticamente cuánto vuelto (cambio) debes entregar.
4. Presiona **Registrar Cobro Exitoso**.

---

## ⚙️ Instalación y Despliegue

Para que el sistema se comunique correctamente con la nube, sigue estos pasos:

1. Crea un nuevo archivo de **Google Sheets** en tu cuenta de Google Drive.
2. Copia el **ID de la hoja de cálculo** (la cadena larga de caracteres en la URL).
3. Ve a `Extensiones > Apps Script` en tu hoja de cálculo.
4. Pega el contenido de `Nsg.js` ahí.
5. Reemplaza la variable `SPREADSHEET_ID = "AQUÍ_TU_ID";` con el ID que copiaste.
6. Haz clic en **Implementar > Nueva Implementación**. Selecciona tipo **Aplicación Web**, acceso "Cualquier persona".
7. Copia la URL de la aplicación web que te generará.
8. Pega esa URL en tu archivo `Nscript.js`, en la constante `SCRIPT_URL`.
9. ¡Listo! Abre tu archivo `Nindex.html` en el navegador y haz clic en "Ajustes > Conectar / Inicializar Hojas BD" para generar las tablas.

---

## 🔄 Flujo de Datos (Cómo funciona)

1. **Interacción del Usuario:** El usuario interactúa con la interfaz gráfica en `Nindex.html`.
2. **Procesamiento Local:** `Nscript.js` procesa eventos (escanear, escribir, sumar al carrito) sin consultar al servidor hasta que es estrictamente necesario, garantizando rapidez y evitando demoras.
3. **Petición HTTP (Fetch):** Al hacer clic en "Guardar Producto" o "Cobrar", `Nscript.js` empaqueta los datos en un formato JSON y los envía a la URL de Google Apps Script.
4. **Respuesta del Servidor:** `Nsg.js` intercepta la petición, localiza la fila/pestaña correspondiente en Google Sheets, actualiza los datos y devuelve una respuesta `{"status": "success", "message": "..."}`.
5. **Feedback Visual:** `Nscript.js` recibe el *success*, dispara la animación de pantalla (`flash-success`), muestra el mensaje emergente en la parte superior derecha y actualiza las tablas visibles.
