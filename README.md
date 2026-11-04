## Créditos

Adaptación del proyecto [football-predictions de karidasd](https://github.com/karidasd/football-predictions).

# Pronósticos de fútbol

Dashboard en español para consultar partidos y pronósticos de **UEFA Champions League** y **UEFA Europa League** mediante API-Football. Funciona localmente con Python, HTML, CSS y JavaScript.

Los pronósticos proceden de API-Football; el proyecto no entrena un modelo propio. Son orientativos y no garantizan aciertos ni ganancias.

## Cambios respecto al proyecto original

- **Competiciones específicas:** consulta Champions League y Europa League del día, según la hora de Perú (`America/Lima`).
- **Interfaz en español:** filtros combinables por competición y estado: todos, por comenzar, en juego o finalizados. Incluye navegación con teclado y vistas de tarjetas o tabla.
- **Actualizador local:** consulta nuevos partidos por lotes mientras el servidor está abierto y deja de consultar cuando no quedan nuevos encuentros elegibles, alcanza su límite local o recibe un error.
- **Control de solicitudes:** separa las llamadas por 6,2 segundos, limita el uso local a 100 solicitudes al día y registra los partidos consultados para evitar repetir peticiones de pronósticos.
- **Persistencia e histórico:** conserva el primer pronóstico guardado de cada partido para compararlo con el marcador final. Los pronósticos eliminados antes de existir el archivo histórico no pueden recuperarse desde él.
- **Consulta sin servidor:** permite abrir `index.html` directamente para ver la última copia guardada, sin consultar la API.
- **Finalizados visibles:** muestra sus marcadores y el pronóstico original cuando está disponible. La comparación automática se realiza para partidos terminados en tiempo reglamentario (`FT`).
- **Flujo simplificado:** se retiraron los workflows automáticos de GitHub, las consultas de cuotas y la sección de marcadores en vivo. Las claves se proporcionan mediante una variable de entorno.

## Requisitos

- Python 3.10 o posterior, con el comando `py` disponible en Windows.
- Una clave de [API-Football](https://www.api-football.com/) con acceso a las competiciones y temporadas que quieras consultar.
- Conexión a Internet para actualizar datos.

## Iniciar en Windows

1. Clona el repositorio y entra en su carpeta:

   ```powershell
   git clone https://github.com/JoseDMG1/pronosticos-de-futbol.git
   cd pronosticos-de-futbol
   ```

2. Instala las dependencias necesarias para el actualizador local:

   ```powershell
   py -m pip install requests tzdata
   ```

3. Configura tu clave en esa misma ventana de PowerShell e inicia el servidor:

   ```powershell
   $env:API_FOOTBALL_KEY = "TU_CLAVE_API"
   .\start-local.ps1
   ```

4. Abre **http://127.0.0.1:8000**. Detén el servidor con **Ctrl+C**.

La página relee los archivos locales cada minuto; esa lectura no consume solicitudes de API-Football. El actualizador consulta una lista de encuentros y hasta nueve pronósticos por lote. Al detenerse el actualizador, el servidor sigue mostrando los datos guardados hasta que lo cierres.

El contador local se reinicia al cambiar el día en Perú y no conoce el consumo de otros programas con la misma clave. La cuota y su reinicio en API-Football pueden diferir: revisa el panel del proveedor si recibes un error `429`.

## Ver los datos sin iniciar el servidor

Después de una actualización, abre **`index.html`** directamente en el navegador. Cargará `data/offline-predictions.js`, generado junto con los JSON. Verás el último estado guardado; los marcadores no se actualizarán sin ejecutar el actualizador. Los logotipos y las fuentes externas pueden necesitar Internet.

## Archivos principales

- `index.html`, `style.css`, `script.js`: interfaz, filtros y visualización.
- `start-local.ps1`: comando de inicio para Windows.
- `scripts/run_local.py`: servidor local y ejecución del actualizador.
- `scripts/fetch_predictions.py`: consultas a API-Football y guardado de datos.
- `data/predictions_today.json`: partidos y pronósticos del día; `predictions.json` contiene una copia compatible.
- `data/offline-predictions.js`: copia para abrir el HTML sin servidor.
- `data/forecast_archive/`: histórico de pronósticos originales por fecha.
- `data/.api_usage.json` y `data/.api_attempted.json`: contadores y registro de consultas locales, excluidos de Git.

Al arrancar en un nuevo día, se limpia la vista diaria anterior, conservando el archivo histórico. Un partido en juego muestra el pronóstico guardado; eso no implica que se recalcule con cada evento del encuentro.
