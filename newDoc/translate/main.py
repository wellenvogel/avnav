#! /usr/bin/env python3
'''
copied from https://github.com/the-asind/gemini-markdown-translate/
translate files with gemini
'''
import os
import sys
import getopt
#MODEL="gemini-3.5-flash"
MODEL="gemini-3.1-flash-lite"
from google import genai
# Get the directory path of the current file
dir_path = os.path.dirname(os.path.realpath(__file__))

def get_api():
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key is None:
        err(f"GEMINI_API_KEY environment variable not set")
    # Create the model with system instructions
    client = genai.Client(api_key=api_key)
    return client

def list_models():
    client=get_api()
    for model in client.models.list():
        print(model)

def translate_file(file_path, output_path):
    """
    Translates the content of a file using the Google Gemini API and writes the translated content to an output file.

    Args:
        file_path (str): The path to the input file to be translated.
        output_path (str): The path to the output file where the translated content will be saved.
    """
    # Read the system instructions from promt.md
    with open(os.path.join(dir_path, 'prompt.md'), 'r', encoding='utf-8') as file:
        system_instructions = file.read()
    response = None
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()
    client=get_api()
    prompt=system_instructions+"\n"+content
    print(f"using model {MODEL}")
    try:
        # Call the Google Gemini API to translate the content
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
        )

        # Check if the response contains valid Part
        if not response.text:
            raise ValueError("Invalid operation: The `response.text` quick accessor requires the response to contain "
                             "a valid `Part`, but none were returned.")

        translated_content = response.text.strip()

        # Write the translated content to the output file
        with open(output_path, 'w', encoding='utf-8') as file:
            file.write(translated_content)

    except ValueError as e:
        # Check the candidate.safety_ratings to determine if the response was blocked
        if hasattr(response, 'candidate') and hasattr(response.candidate, 'safety_ratings'):
            safety_ratings = response.candidate.safety_ratings
            print(f"Translation blocked due to safety ratings: {safety_ratings}")
        else:
            print(f"Error: {e}")
        print(f"\033[91mFailed to translate: {file_path[len(dir_path):]}\033[0m")


def err(txt,prefix='ERROR: '):
    print(f"{prefix or ''} {txt}",file=sys.stderr)
    sys.exit(1)
ARGS='lhm:'
USAGE=f"Usage: {sys.argv[0]} [-l] [-m model] [-h] <input-file> <output-file>"
if __name__ == '__main__':
    optlist, args = getopt.getopt(sys.argv[1:], ARGS)
    for o, a in optlist:
        if o == '-l':
            list_models()
            sys.exit(0)
        elif o == '-h':
            print(USAGE)
            sys.exit(0)
        elif o == '-m':
            MODEL = a
        else:
            assert False, "unhandled option"
    if len(args) < 2:
        print(USAGE)
        sys.exit(1)
    infile = args[0]
    outfile = args[1]
    if not os.path.exists(infile):
        err(f"File not found: {infile}",prefix='')
    outdir=os.path.dirname(outfile)
    if not os.path.isdir(outdir):
        os.makedirs(outdir)
    if not os.path.isdir(outdir):
        err(f"unable to create output directory {outdir}")
    translate_file(infile, outfile)