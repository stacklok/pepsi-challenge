# Pepsi-Taste. LLM model evaluation

## Introduction

### Supported Platforms

This repository contains the server code for testing and validating Stacklok 
fine-tuned models. It supports both NVIDIA GPUs (CUDA) and Apple Silicon (Metal)
platforms, so a local dev environment can be setup.

### GPU Support

- NVIDIA GPUs: CUDA 12.1
- Apple Silicon: Metal Performance Shaders (MPS)

## Server Setup

First, clone the repository:
```bash
git clone https://github.com/stacklok/pepsi-challenge.git
cd pepsi-challenge/
cd backend/
```

Then install requirements based on your platform:

For MacOS:
```bash
pip install -r requirements-macos.txt
```

For CUDA systems:
```bash
pip install -r requirements-cuda.txt
```

Finally, run the application:
```bash
python main.py
```

### Prerequisites

The test environment supports:
- NVIDIA GPUs: Deep Learning VM with CUDA 12.1, M126, Debian 11, Python 3.10
- Apple Silicon: macOS with Python 3.10+ and PyTorch 2.0+

The application will automatically detect the available GPU type and optimize accordingly.



