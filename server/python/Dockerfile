FROM nbarlow/wrattler_python_service:v1.0

ADD . /app
WORKDIR /app

ENV FLASK_APP app.py
EXPOSE 7101
CMD ["python3","app.py"]