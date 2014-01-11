n=$1
gpsbabel -c utf8 -i kml -f "$n" -o gpx -F "$n.gpx"
