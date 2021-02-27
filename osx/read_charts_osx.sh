#! /bin/sh
#a wrapper to set up some strange python environment
#updated to the latest 2.7. and new PIL,gdal
export PYTHONPATH=/Library/Python/2.6/site-packages
`dirname $0`/../chartconvert/read_charts.py $*

