FROM public.ecr.aws/lambda/python:3.11

ENV U2NET_HOME=/tmp/.u2net
ENV NUMBA_CACHE_DIR=/tmp/numba_cache
ENV NUMBA_DISABLE_JIT=1
ENV PYTHONUNBUFFERED=1

RUN yum update -y && \
    yum install -y \
    mesa-libGL \
    glib2 \
    gcc \
    gcc-c++ \
    && yum clean all \
    && rm -rf /var/cache/yum

COPY requirements.txt ${LAMBDA_TASK_ROOT}/

RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

COPY app.py ${LAMBDA_TASK_ROOT}/

CMD ["app.lambda_handler"]
