import os
import json
import time
import pika

RABBITMQ_URL = os.environ["RABBITMQ_URL"]


def procesar_user_event(ch, method, properties, body):
    """Callback para mensajes del exchange 'user_events'."""
    try:
        datos = json.loads(body)
        if datos.get("action") == "user_deleted":
            print("-" * 50)
            print("[ALERTA DE SISTEMA: USUARIO ELIMINADO]")
            print(f"  Usuario ID : {datos['user_id']}")
            print(f"  Acción     : El Task-Service limpiará las tareas huérfanas.")
            print("-" * 50)
    except Exception as e:
        print(f"[!] Error procesando user_event: {e}")
    finally:
        # ACK siempre en finally: incluso si hay error, no reencolar indefinidamente
        ch.basic_ack(delivery_tag=method.delivery_tag)


def procesar_task_event(ch, method, properties, body):
    """Callback para mensajes del exchange 'task_events'."""
    try:
        datos = json.loads(body)
        print("-" * 50)
        print("[NUEVA NOTIFICACIÓN DE TAREA]")
        print(f"  Destinatario : Usuario ID {datos['user_id']}")
        print(f"  Mensaje      : La tarea '{datos['title']}' ha sido creada.")
        print("-" * 50)
    except Exception as e:
        print(f"[!] Error procesando task_event: {e}")
    finally:
        ch.basic_ack(delivery_tag=method.delivery_tag)


def iniciar_worker():
    """
    Consumer con reconexión automática que escucha dos colas simultáneamente.
    pika permite registrar múltiples basic_consume en el mismo canal;
    start_consuming() despacha los callbacks según de qué cola llegue el mensaje.
    """
    while True:
        try:
            parametros = pika.URLParameters(RABBITMQ_URL)
            conexion = pika.BlockingConnection(parametros)
            canal = conexion.channel()

            # Declarar exchanges (idempotente: no falla si ya existen)
            canal.exchange_declare(exchange="user_events", exchange_type="fanout", durable=True)
            canal.exchange_declare(exchange="task_events", exchange_type="fanout", durable=True)

            # Declarar colas durables y vincularlas a sus exchanges
            canal.queue_declare(queue="notification.user_events", durable=True)
            canal.queue_bind(exchange="user_events", queue="notification.user_events")

            canal.queue_declare(queue="notification.task_events", durable=True)
            canal.queue_bind(exchange="task_events", queue="notification.task_events")

            # Procesar un mensaje a la vez por cola
            canal.basic_qos(prefetch_count=1)

            # Registrar un callback distinto por cola
            canal.basic_consume(queue="notification.user_events", on_message_callback=procesar_user_event)
            canal.basic_consume(queue="notification.task_events", on_message_callback=procesar_task_event)

            print("[*] Notification Worker listo. Escuchando:")
            print("      - notification.user_events  (exchange: user_events)")
            print("      - notification.task_events  (exchange: task_events)")

            canal.start_consuming()

        except KeyboardInterrupt:
            print("\n[*] Worker detenido manualmente.")
            break
        except Exception as e:
            print(f"[!] Worker desconectado: {e}. Reintentando en 5s...")
            time.sleep(5)


if __name__ == "__main__":
    iniciar_worker()
