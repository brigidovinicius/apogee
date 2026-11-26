FROM python:3.13-slim-bookworm
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 ALBUM_DATA=/data ALBUM_MODELS=/opt/models \
    OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY album.py cli.py service.py vision.py ./
RUN python cli.py models && mkdir -m 700 /data && chown -R 10001:10001 /data /opt/models
USER 10001:10001
EXPOSE 8786
CMD ["gunicorn", "--bind", "0.0.0.0:8786", "--workers", "1", "--threads", "4", "--timeout", "35", "service:create_app()"]
