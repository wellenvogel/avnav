#! /bin/sh
#a wrapper to set up some strange python environment
#as we have PIL only available in 2.5 and 32 bit mode, just set some env:
export PYTHONPATH=/usr/lib/python2.5//site-packages/
export VERSIONER_PYTHON_PREFER_32_BIT=yes
`dirname $0`/../chartconvert/read_charts.py $*

