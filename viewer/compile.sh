#! /bin/sh
#--root ..\libraries\ol3b4\ol --root ..\libraries\ol3b4\googx
../libraries/closure-library/closure/bin/build/closurebuilder.py --root . --root ../libraries/closure-library  --namespace=avnav.main --output_mode=compiled --compiler_jar=../libraries/closure-library/compiler.jar --output_file=avnav_min.js
