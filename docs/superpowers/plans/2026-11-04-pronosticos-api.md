# Plan de implementación: pronósticos antes y durante el partido

**Objetivo:** mostrar información de API-Football para encuentros pendientes o en juego, excluyendo finalizados y sin automatizar consultas para evaluar resultados posteriores.

**Arquitectura:** Python consulta la API con una clave en el entorno y publica JSON; la web presenta los datos y su fecha de actualización. Las consultas periódicas se ejecutan en Python, nunca con una clave privada en el navegador.

**Tecnologías:** Python, requests, JavaScript, HTML y GitHub Actions.

**Especificación:** instrucciones del usuario en esta conversación: usar solo API-Football, admitir antes o durante el encuentro, excluir finalizados y planificar primero. Aplicar la estructura de writing-plans; la implementación queda fuera de esta etapa.

## Restricciones

- No garantizar aciertos ni rentabilidad.
- No presentar un pronóstico previo al partido como recalculado en vivo.
- No suponer que API-Football ofrece cuotas de ApuestaTotal.
- No ejecutar llamadas reales ni consumir cuota durante la planificación.
- Preservar cambios locales y archivos ajenos a esta tarea.

## Riesgos que deben quedar cubiertos

- Una respuesta vacía no debe confundirse con clave inválida o límite agotado.
- Los primeros diez partidos del día pueden estar finalizados; filtrar antes de limitar.
- Datos guardados pueden quedar obsoletos mientras la página sigue abierta.
- Una interrupción o suspensión debe identificarse sin tratarla como un encuentro normal en juego.
- El estado NS solo no garantiza que la hora prevista siga en el futuro.

## 1. Verificar el contrato de API-Football

- [ ] Consultar documentación oficial de fixtures, predictions y odds; registrar estados permitidos y disponibilidad real de predicciones/cuotas durante un encuentro.
- [ ] Distinguir pronóstico previo, marcador actual y cuotas en vivo. Si no existen pronósticos recalculados durante el juego, mostrar explícitamente esa limitación.
- [ ] Revisar límites del plan sin revelar claves. Elegir frecuencia de actualización y presupuesto máximo de consultas a partir de esos límites.

Resultado: contrato documentado en README.md; ninguna capacidad en vivo se promete sin respaldo.

## 2. Corregir selección y extracción

Archivo: scripts/fetch_predictions.py.

- [ ] Sustituir el filtro exclusivo NS por una lista explícita de estados pendientes y en juego validada en el paso 1; excluir finalizados, cancelados y aplazados.
- [ ] Seleccionar por fecha de America/Lima solicitando la zona horaria a la API; ordenar y filtrar antes de limitar candidatos. En NS, excluir horas de inicio ya pasadas y señalar que requieren actualizar estado.
- [ ] Guardar estado original, hora de consulta y origen de cada pronóstico. Mantener compatibilidad con los JSON que consume script.js.
- [ ] Añadir timeout, tratamiento de errores HTTP y del campo errors de la API, y conteo real de llamadas incluyendo cuotas. No sobrescribir datos válidos con errores silenciosos.
- [ ] Conservar recomendaciones de la API. Revisar generate_short_tip y eliminar conversiones no justificadas de goles y porcentajes que actualmente generan GG y Over/Under; usar un campo oficial válido o mostrar no disponible.

Comprobación prevista: respuestas simuladas con NS futuro/pasado, partido en juego, FT/AET/PEN, cancelación, predicción ausente, error de API y cuotas ausentes. Confirmar que ninguna predicción se solicita para finalizados.

## 3. Actualizar el panel y la información obsoleta

Archivos: script.js, index.html y style.css si es necesario.

- [ ] Mostrar secciones antes del inicio/en juego y la fecha de actualización; filtrar también estados excluidos al leer JSON antiguos.
- [ ] Retirar del flujo activo la carga de history.json y el panel de precisión histórica.
- [ ] Añadir actualización periódica del JSON, coordinada con el generador. Indicar cuándo los datos están desactualizados; releer un JSON no actualiza la API por sí mismo.
- [ ] Mostrar ausencia de encuentros o pronósticos con un mensaje claro, sin consejos inventados.
- [ ] Insertar contenido externo con textContent y atributos validados para evitar que datos de la API se ejecuten como HTML.

Comprobación prevista: datos mixtos, archivo antiguo con Finished, actualización del estado en una segunda carga, error de red y valores HTML maliciosos. No afirmar que una lista está en vivo cuando el generador no está actualizándola.

## 4. Ajustar ejecución local y automatización

Archivos: .github/workflows/evening_results.yml, .github/workflows/morning_predictions.yml, scripts/fetch_results.py y README.md.

- [ ] Desactivar la programación de evaluación nocturna y dejar fetch_results.py fuera del flujo habitual, preservando los datos históricos existentes.
- [ ] Ofrecer modo local periódico, detenido con Ctrl+C, con intervalo y límite de consultas definidos tras el paso 1. Mantener ejecución única disponible.
- [ ] Adaptar la programación de Actions al presupuesto real; documentar que Actions no asegura actualización continua ni puntual al segundo.
- [ ] Usar secrets.API_FOOTBALL_KEY en Actions; retirar la clave del widget público y configurar los widgets únicamente si existe una opción compatible con la protección de la credencial.
- [ ] Documentar arranque del generador y servidor web ligado a 127.0.0.1, consumo de cuota y limitaciones durante encuentros.

Comprobación prevista: revisar YAML y probar modos único/periódico con API simulada, sin secretos reales ni consumo de cuota. Una comprobación real posterior deberá informar número de solicitudes, campos recibidos y estados, sin publicar credenciales.

## Criterio de finalización

Solo aparecen partidos pendientes o en juego según datos recientes; las tarjetas identifican origen y antigüedad del pronóstico; los errores son visibles; las consultas respetan presupuesto; la automatización no evalúa resultados finales. Las pruebas comprueban funcionamiento, no demuestran precisión de los pronósticos.

## Revisión del plan

Los pasos cubren extracción, presentación y automatización. La disponibilidad de predicciones recalculadas en vivo y el límite del plan API son condiciones por verificar antes de implementar esa función. No se ha implementado este plan.
