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
TARGET='en'
PROMPT_FILE=None #default: prompt.md next to this script
SKIP_PATTERN=['issues-']
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
def get_prompt_file():
    return PROMPT_FILE or os.path.join(dir_path, 'prompt.md')
def translate_file(file_path, output_path):
    """
    Translates the content of a file using the Google Gemini API and writes the translated content to an output file.

    Args:
        file_path (str): The path to the input file to be translated.
        output_path (str): The path to the output file where the translated content will be saved.
    """
    print(f"translating '{file_path}' to '{output_path}'")
    # Read the system instructions from promt.md
    with open(get_prompt_file(), 'r', encoding='utf-8') as file:
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


def translate_stdin():
    """
    Translates all of stdin with a single request and writes the result to stdout.
    """
    with open(get_prompt_file(), 'r', encoding='utf-8') as file:
        system_instructions = file.read()
    content = sys.stdin.read()
    client = get_api()
    response = client.models.generate_content(
        model=MODEL,
        contents=system_instructions + "\n" + content,
    )
    if not response.text:
        err("no translation returned")
    print(response.text.strip())


def handleFile(infile, outfile, automode, force=False,dryRun=False, ignorePrompt=False):
    if not os.path.exists(infile):
        err(f"File not found: {infile}",prefix='')
    for pattern in SKIP_PATTERN:
        if pattern in infile:
            print(f"Skipping file '{infile}' due to skip pattern '{pattern}'")
            return
    if automode:
        if not ignorePrompt:
            ptime=os.stat(get_prompt_file()).st_mtime
        else:
            ptime=None
        outfile=None
        parts=infile.split(os.path.sep)
        found=False
        for part in parts:
            if part == 'de':
                found=True
                part=TARGET
            if outfile:
                outfile = os.path.join(outfile,part)
            else:
                outfile = part
        if not found:
            err("no directory 'de' in "+infile)
        if not force:
            itime=os.stat(infile).st_mtime
            if os.path.exists(outfile):
                otime=os.stat(outfile).st_mtime
                if itime <= otime and ( ptime is None or otime >= ptime):
                    print(f"File '{outfile}' is newer than '{infile}', skipping")
                    return 0
                if ptime is not None and otime < ptime:
                    print(f"File '{outfile}' is older than the prompt file, must handle")
    else:
        outfile = outfile
    if dryRun:
        print(f"Dry run: would translate '{infile}' to '{outfile}'")
        return
    outdir=os.path.dirname(outfile)
    if not os.path.isdir(outdir):
        os.makedirs(outdir)
    if not os.path.isdir(outdir):
        err(f"unable to create output directory {outdir}")
    translate_file(infile, outfile)

def err(txt,prefix='ERROR: '):
    print(f"{prefix or ''} {txt}",file=sys.stderr)
    sys.exit(1)

ARGS='lhm:afnrp:si'
USAGE=f"Usage: {sys.argv[0]} [-l] [-m model] [-p promptfile] [-s] [-h] [-r] [-a] [-n] [-f] [-i] <input-file> [<output-file>]\n  -p: markdown file with the translation instructions (default prompt.md)\n  -s: translate stdin to stdout with one request"
if __name__ == '__main__':
    automode=False
    force=False
    dryRun=False
    recurse=False
    stdinMode=False
    ignorePrompt=False
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
        elif o == '-p':
            PROMPT_FILE = a
        elif o == '-s':
            stdinMode=True
        elif o == '-a':
            automode=True
        elif o == '-f':
            force=True
        elif o == '-n':
            dryRun=True
            automode=True
        elif o == '-r':
            recurse=True
        elif o == '-i':
            ignorePrompt=True
        else:
            assert False, "unhandled option"
    if stdinMode:
        translate_stdin()
        sys.exit(0)
    minargs=2 if not automode else 1
    if len(args) < minargs:
        print(USAGE)
        sys.exit(1)
    infile=args[0]
    if recurse:
        for root, dirs, files in os.walk(infile):
            for file in files:
                ext=os.path.splitext(file)[1]
                if ext.lower() != '.md':  
                    continue
                fname=os.path.join(root, file)
                if "de/" not in fname:
                    continue
                handleFile(fname, None, automode, force, dryRun, ignorePrompt=ignorePrompt)
    else:
        outfile=args[1] if len(args) > 1 else None
        handleFile(infile, outfile, automode, force,dryRun, ignorePrompt=ignorePrompt)
    