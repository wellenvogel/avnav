#! /usr/bin/env python3
# vim: ts=4 sw=4 et
import pprint
import os
import sys
from stat import *
            

# This parses through a given map directory and generates a gemf file.

file_size_limit = 2000000000

def main():
    import sys
    arguments = sys.argv[1:]
    options = {}
    for argument in arguments:
        if argument.startswith('--'):
            options[argument[2:]] = True
        else:
            mapdir = argument
    import time
    timestr = time.strftime("%Y%m%d-%H%M%S")
    if mapdir is None:
        print("usage: generate_efficient_map_file.py [--update] mapdir")
        sys.exit(1)
    if not os.path.isdir(mapdir):
        print("%s is no directory" %(mapdir))
        sys.exit(1)
    outfile=os.path.join(mapdir,"avnav.gemf")
    marker=os.path.join(mapdir,"avnav.xml")
    if options.get('update'):
        if os.path.exists(marker) and os.path.exists(outfile):
            ostat=os.stat(outfile)
            cstat=os.stat(marker)
            if (cstat.st_mtime <= ostat.st_mtime):
                print("file %s is newer then %s, no need to generate" %(marker,outfile))
                sys.exit(0)
    MakeGEMFFile(mapdir, outfile, options)

def valtoNbytes(value, n):
    result = []
    for i in range(n):
        result.append(value & 0xFF)
        value >>= 8
    result.reverse()
    return result

def valto4bytes(value):
    return valtoNbytes(value, 4)

def valto8bytes(value):
    return valtoNbytes(value, 8)

def MakeGEMFFile(mapdir, output_file, options):
    tilesize = 256

    extensions = (".png.tile", ".jpg.tile", ".png", ".jpg")

    all_sources = {}
    source_order = []
    source_index = 0
    source_indices = {}
    count = {}

    try:
        from map_priority import priority
    except ImportError:
        print("No priority file found")
        priority = []

    unsorted_source_list = os.listdir(mapdir)
    source_list = []

    # If the maps are in the imported priority
    # list, these should be added first
    order = 0
    for s in priority:
        if s in unsorted_source_list:
            print("Source %d: %s" % (order, s))
            order += 1
            source_list.append(s)
    for s in unsorted_source_list:
        if s not in priority:
            source_list.append(s)
            print("Source %d: %s" % (order, s))
            order += 1

    for source in source_list:
        print("Handling map %s" % (source))
        results = {}
        source_mapdir = os.path.join(mapdir, source)
        if not os.path.isdir(source_mapdir):
            print("Skipping " + source_mapdir)
            continue

        source_indices[source] = source_index

        # Generate results[zoom][x] = [y1,y2,...]
        for zoom_level_str in os.listdir(source_mapdir):

            zoom_dir = os.path.join(source_mapdir, zoom_level_str)
            if not os.path.isdir(zoom_dir):
                print("Skipping " + zoom_dir)
                continue
            zoom_level = int(zoom_level_str)
            results[zoom_level] = {}

            for x_str in os.listdir(zoom_dir):
                x_set = []
                x_val = int(x_str)

                x_dir = os.path.join(zoom_dir, x_str)
                if not os.path.isdir(x_dir):
                    print("Skipping " + x_dir)
                    continue

                for y_str in os.listdir(x_dir):
                    y_val = int(y_str.split('.')[0])
                    x_set.append(y_val)

                results[zoom_level][x_val] = x_set[:]


        if 'allow-empty' in options:
            full_sets = {}
            for zoom_level in list(results.keys()):
                full_sets[zoom_level] = []
                xmax = max(results[zoom_level].keys())
                xmin = min(results[zoom_level].keys())
                y_vals = []
                for x_val in list(results[zoom_level].keys()):
                    y_vals += results[zoom_level][x_val]
                ymax = max(y_vals)
                ymin = min(y_vals)
                full_sets[zoom_level].append(
                        {'xmin': xmin, 'xmax': xmax,
                            'ymin': ymin, 'ymax': ymax,
                            'source_index': source_index})

        else:
            # Build a list of tile rectangles that may have missing slices, but have square corners.

            # A record representing a square of 1-5 tiles at zoom 10
            # unique_sets[zoom][Y values key] = [X values array]
            # unique_sets[10]["1-2-3-4-5"] = [1,2,3,4,5]
            unique_sets = {}
            for zoom_level in list(results.keys()):
                unique_sets[zoom_level] = {}
                for x_val in list(results[zoom_level].keys()):

                    # strkey: Sorted list of Y values for a zoom/X, eg: "1-2-3-4"
                    strkey = "-".join(["%d" % i for i in sorted(results[zoom_level][x_val])])
                    if strkey in list(unique_sets[zoom_level].keys()):
                        unique_sets[zoom_level][strkey].append(x_val)
                    else:
                        unique_sets[zoom_level][strkey] = [x_val,]

            # Find missing X rows in each unique_set record 
            split_xsets = {}
            for zoom_level in list(results.keys()):
                split_xsets[zoom_level] = []
                for xset in list(unique_sets[zoom_level].values()):
                    setxmin = min(xset)
                    setxmax = max(xset)
                    last_valid = None
                    for xv in range(setxmin, setxmax+2):
                        if xv not in xset and last_valid is not None:
                            split_xsets[zoom_level].append({'xmin': last_valid, 'xmax': xv-1})
                            last_valid = None
                        elif xv in xset and last_valid is None:
                            last_valid = xv

            #pprint.pprint(split_xsets)

            # Find missing Y rows in each unique_set chunk, create full_sets records for each complete chunk

            full_sets = {}
            for zoom_level in list(split_xsets.keys()):
                full_sets[zoom_level] = []
                for xr in split_xsets[zoom_level]:
                    yset = results[zoom_level][xr['xmax']]
                    if yset is None or len(yset) == 0:
                        continue
                    setymin = min(yset)
                    setymax = max(yset)
                    last_valid = None
                    for yv in range(setymin, setymax+2):
                        if yv not in yset and last_valid is not None:
                            full_sets[zoom_level].append({'xmin': xr['xmin'], 'xmax': xr['xmax'],
                                'ymin': last_valid, 'ymax': yv-1,
                                'source_index': source_index})
                            last_valid = None
                        elif yv in yset and last_valid is None:
                            last_valid = yv

            #pprint.pprint(full_sets)

        count[source] = {}
        for zoom_level in list(full_sets.keys()):
            count[source][zoom_level] = 0
            for rangeset in full_sets[zoom_level]:
                for xv in range(rangeset['xmin'], rangeset['xmax']+1):
                    for yv in range(rangeset['ymin'], rangeset['ymax']+1):
                        found = False
                        for extension in extensions:
                            fpath = os.path.join(source_mapdir, '%d/%d/%d%s' % (zoom_level, xv, yv, extension))
                            if os.path.exists(fpath):
                                found = True
                                break
                        if not found and 'allow-empty' not in options:
                            raise IOError("Could not find file (%s, %d, %d, %d)" % (source, zoom_level, xv, yv))

                        count[source][zoom_level] += 1
            print(source_mapdir, zoom_level, count[source][zoom_level])

        all_sources[source] = full_sets
        source_order.append(source)
        source_index += 1


    u32_size = 4
    u64_size = 8
    range_size = (u32_size * 6) + (u64_size * 1) # xmin, xmax, ymin, ymax, zoom, source, offset
    file_info_size = u64_size + u32_size
    number_of_ranges = 0
    number_of_files = 0
    for source in source_order:
        full_sets = all_sources[source]
        number_of_ranges += sum([len(full_sets[i]) for i in list(full_sets.keys())])
        number_of_files += sum(count[source].values())
    source_count = 0

    source_list = []
    for source in source_order:
        source_list += valto4bytes(source_indices[source])
        source_list += valto4bytes(len(source))
        source_list += [i for i in source.encode('ascii', 'ignore')]
        source_count += 1

    source_list_size = len(source_list)

    gemf_version = 4

    pre_info_size = (u32_size + # GEMF Version
            u32_size + # Tile size
            u32_size + # Number of ranges
            u32_size + # Number of sources
            source_list_size + # Size of source list
            number_of_ranges * range_size) # Ranges
    header_size = (pre_info_size +
            (number_of_files * file_info_size)) # File header info

    image_offset = header_size

    print("Source Count:", source_count)
    print("Source List Size:", source_list_size)
    print("Source List:", repr(source_list))
    print("Pre Info Size:", pre_info_size)
    print("Number of Ranges:", number_of_ranges)
    print("Number of files:", number_of_files)
    print("Header Size (first image location): 0x%08X" % header_size)

    header = []
    header += valto4bytes(gemf_version)
    header += valto4bytes(tilesize)
    header += valto4bytes(source_count)
    header += source_list

    header += valto4bytes(number_of_ranges)

    data_locations = []
    data_location_address = 0

    file_list = []

    first_range = True
    first_tile = True

    tile_count = 0
    for tile_source in source_order:
        full_source_set = all_sources[tile_source]

        for zoom_level in list(full_source_set.keys()):
            for rangeset in full_source_set[zoom_level]:
                if first_range:
                    h = len(header)
                    print("First range at 0x%08X" % len(header))
                header += valto4bytes(zoom_level)
                header += valto4bytes(rangeset['xmin'])
                header += valto4bytes(rangeset['xmax'])
                header += valto4bytes(rangeset['ymin'])
                header += valto4bytes(rangeset['ymax'])
                header += valto4bytes(rangeset['source_index'])
                header += valto8bytes(data_location_address + pre_info_size)

                if first_range:
                    hb = header[h:]
                    print("Range Data: [" + ",".join(["%02X" % i for i in hb]) + "]")
                    print("First Data Location: 0x%08X" % (data_location_address + pre_info_size))
                    first_range = False

                for xv in range(rangeset['xmin'],rangeset['xmax']+1):
                    for yv in range(rangeset['ymin'],rangeset['ymax']+1):
                        found = False
                        for extension in extensions:
                            fpath = os.path.join(mapdir, '%s/%d/%d/%d%s' % (tile_source, zoom_level, xv, yv, extension))
                            if os.path.exists(fpath):
                                found = True
                                break

                        if not found:
                            if 'allow-empty' in options:
                                file_size = 0
                            else:
                                raise IOError("Could not find file (%s, %d, %d, %d)" % (tile_source, zoom_level, xv, yv))
                        else:
                            file_size = os.path.getsize(fpath)
                        file_list.append(fpath)

                        # This file is at image_offset, length file_size
                        data_locations += valto8bytes(image_offset)
                        data_locations += valto4bytes(file_size)
                        tile_count += 1

                        if first_tile:
                            print("First Tile Info: [" + ",".join(["%02X" % i for i in data_locations]) + "]")
                            print("(0x%016X, 0x%08X)" % (image_offset, file_size))
                            first_tile = False

                        data_location_address += u64_size + u32_size

                        # Update the image_offset
                        image_offset += file_size

    print("Header Length is 0x%08X" % len(header))
    print("First tile expected at 0x%08X" % (len(header) + len(data_locations)))
    print("Tile Count is %d (c.f. %d)" % (tile_count, number_of_files))
    print("")
    fhHeader = open(output_file, 'wb')
    fhHeader.write(bytes(header))
    fhHeader.write(bytes(data_locations))

    file_size = len(header) + len(data_locations)
    index = 0
    numwritten=0
    percent=-1
    for fn in file_list:
        if os.path.exists(fn):
            this_file_size = os.path.getsize(fn)
        else:
            if 'allow-empty' in options:
                this_file_size = 0
            else:
                raise IOError("Could not find file %s" % fn)
        if (file_size + this_file_size) > file_size_limit:
            fhHeader.close()
            index += 1
            fname = output_file + "-%d" % index
            fhHeader = open(fname, 'wb')
            print("Skipping to new file %s after %d bytes" %(fname,file_size))
            file_size = 0

        if os.path.exists(fn):
            fhIn = open(fn, 'rb')
            fhHeader.write(fhIn.read())
            fhIn.close()
        numwritten+=1
        npercent=int(numwritten*100/number_of_files)
        if npercent != percent:
            percent=npercent
            sys.stdout.write("\r%2d%%" % percent)
            sys.stdout.flush()

        file_size += this_file_size

    fhHeader.close()
    print("Written %d bytes" % (file_size))

if __name__ == "__main__":
    main()
