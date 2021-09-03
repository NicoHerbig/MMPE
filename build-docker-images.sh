#!/bin/bash
sudo -- sh -c 'export DOCKER_BUILDKIT=1; \
  docker build -t dfki/mmpe-core:1.0.0 -f Dockerfile-MMPE-Core . ; \
  docker build -t dfki/mmpe-ipe:1.0.0 -f Dockerfile-MMPE-IPE .'
