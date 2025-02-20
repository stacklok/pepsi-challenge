from peft import PeftModel
import torch
from flask import Flask, request, render_template_string
import platform
import os
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def get_device():
    if torch.cuda.is_available():
        return "cuda"
    elif torch.backends.mps.is_available():
        return "mps"
    return "cpu"

device = get_device()
IS_MACOS = platform.system() == "Darwin"

max_seq_length = 2048
dtype = None
load_in_4bit = True and not IS_MACOS  # Need to disable 4-bit quantization on MacOS

def load_base_model(model_name):
    global load_in_4bit

    if IS_MACOS:
        # Use standard transformers library for MacOS
        from transformers import AutoModelForCausalLM, AutoTokenizer
        
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            device_map="auto",
            torch_dtype=torch.float32 if device == "mps" else torch.float16
        )
        tokenizer = AutoTokenizer.from_pretrained(model_name)
    else:
        # Use unsloth for CUDA devices
        from unsloth import FastLanguageModel
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=model_name,
            max_seq_length=max_seq_length,
            dtype=dtype,
            load_in_4bit=load_in_4bit,
        )
    return model, tokenizer

def load_peft_model(base_model, peft_model):
    model, tokenizer = load_base_model(base_model)
    model = PeftModel.from_pretrained(model, peft_model)
    return model, tokenizer

# Initialize models (should move this to config and cmd args)
base_model, tokenizer = load_base_model("Qwen/Qwen2.5-Coder-0.5B")
peft_model, tokenizer = load_peft_model("Qwen/Qwen2.5-Coder-0.5B", "stacklok/Qwen2.5-Coder-0.5B-codegate")

def test_completion(model, tokenizer, examples):
    examples = [f"""<|fim_prefix|>{x["prefix"]}<|fim_suffix|>{x["suffix"]}<|fim_middle|>""" for x in examples]

    if not IS_MACOS:
        from unsloth import FastLanguageModel
        FastLanguageModel.for_inference(model)

    inputs = tokenizer(examples, padding=True, return_tensors="pt").to(device)
    outputs = model.generate(
        **inputs, 
        max_new_tokens=128, 
        use_cache=True, 
        pad_token_id=tokenizer.pad_token_id
    )
    outputs = tokenizer.batch_decode(outputs)
    outputs = [x.split("<|fim_middle|>")[-1].replace("<|endoftext|>", "") for x in outputs]
    return outputs

def compare_base_finetuned(prefix, suffix=""):
    base_response = test_completion(base_model, tokenizer, [{"prefix": prefix, "suffix": suffix}])
    peft_response = test_completion(peft_model, tokenizer, [{"prefix": prefix, "suffix": suffix}])

    return f"""
    <h2>Base Model</h2>
    <code>{prefix}<font color='blue'>{base_response[0]}</font>{suffix}</code>
    <br><br>
    <h2>Finetuned Model</h2>
    <code>{prefix}<font color='blue'>{peft_response[0]}</font>{suffix}</code>
    """

html_template = """
<!DOCTYPE html>
<html>
<head>
    <title>LLM Pepsi Challenge Comparison</title>
</head>
<body>
    <h1>Enter Code Prefix</h1>
    <form method="post">
        <textarea name="prefix" rows="6" cols="60"></textarea><br>
        <input type="submit" value="Compare Models">
    </form>
    <br>
    <div>{{ result|safe }}</div>
</body>
</html>
"""

@app.route('/', methods=['GET', 'POST'])
def home():
    result = ""
    if request.method == 'POST':
        prefix = request.form['prefix']
        result = compare_base_finetuned(prefix)
    return render_template_string(html_template, result=result)

if __name__ == '__main__':
    app.run(debug=True)