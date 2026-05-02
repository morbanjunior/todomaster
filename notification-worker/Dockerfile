FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# En lugar de levantar un servidor, ejecutamos el script puro
CMD ["python", "-u", "main.py"] 
# Nota: "-u" desactiva el buffer de Python para que los 'print' 
# aparezcan inmediatamente en los logs de Docker.