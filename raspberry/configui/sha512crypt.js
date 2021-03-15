/*
 * A JavaScript implementation of the sha512crypt algorithm as implemented
 * by eglibc (http://www.akkadia.org/drepper/SHA-crypt.txt)
 *
 * It uses the fine sha512.js module from Paul Johnston, see sha512.js
 * for details.

Version 0.1 (c) 2013 Michael Vogt <mvo@debian.org>
Distributed under the 2 clause BSD License:

Copyright (c) 2013, Michael Vogt
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

1. Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
notice, this list of conditions and the following disclaimer in the
documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

if (typeof exports !== 'undefined') {
    rstr_sha512 = require("./lib/sha512.js").rstr_sha512;
    binb_sha512 = require("./lib/sha512.js").binb_sha512;
    hex_sha512 = require("./lib/sha512.js").hex_sha512;
    rstr2hex =  require("./lib/sha512.js").rstr2hex;
    rstr2b64 =  require("./lib/sha512.js").rstr2b64;
}


function _extend(source, size_ref) {
    var extended = "";
    for (i=0;i<Math.floor(size_ref/64);i++)
        extended += source;
    extended += source.substr(0, size_ref % 64);
    return extended;
}

// steps 1-12 
function _sha512crypt_intermediate(password, salt) {
    var digest_a = rstr_sha512(password + salt);
    var digest_b = rstr_sha512(password + salt + password);
    var key_len = password.length;

    // extend digest b so that it has the same size as password
    var digest_b_extended = _extend(digest_b, password.length);

    var intermediate_input = password + salt + digest_b_extended;
    for (cnt = key_len; cnt > 0; cnt >>= 1) {
        if ((cnt & 1) != 0)
            intermediate_input += digest_b
        else
            intermediate_input += password;
    }
    var intermediate = rstr_sha512(intermediate_input);

    return intermediate;
}

function _rstr_sha512crypt(password, salt, rounds) 
{
    // steps 1-12
    var digest_a = _sha512crypt_intermediate(password, salt);

    // step 13-15
    var dp_input = "";
    for (i=0;i<password.length;i++)
        dp_input += password;
    var dp = rstr_sha512(dp_input);
    // step 16
    var p = _extend(dp, password.length);

    // step 17-19
    var ds_input = "";
    for (i=0; i < (16+digest_a.charCodeAt(0)); i++)
        ds_input += salt;
    var ds = rstr_sha512(ds_input);
    // step 20
    var s = _extend(ds, salt.length);

    // step 21
    var digest = digest_a;
    var c_input = "";
    for (i=0; i<rounds; i++) {
        c_input = "";        

        if (i & 1) 
            c_input += p;
        else
            c_input += digest;

        if (i % 3)
            c_input += s;

        if (i % 7)
            c_input += p;

        if (i & 1)
            c_input += digest;
        else
            c_input += p;

        digest = rstr_sha512(c_input);
    }

    return digest;
};

function sha512crypt(password, salt) {
    var magic = "$6$";
    var rounds;

    // parse the magic "$" stuff
    var magic_array = salt.split("$");
    if (magic_array.length > 1) {
        if (magic_array[1] !== "6") {
            var s =  "Got '"+salt+"' but only SHA512 ($6$) algorithm supported";
            throw new Error(s);
        }
        rounds = parseInt(magic_array[2].split("=")[1]);
        if (rounds) {
            if (rounds < 1000)
                rounds = 1000;
            if (rounds > 999999999)
                rounds = 999999999;
            salt = magic_array[3] || salt;
        } else {
            salt = magic_array[2] || salt;
        }
    }

    // salt is max 16 chars long
    salt = salt.substr(0, 16);

    var hash = _rstr_sha512crypt(password, salt, rounds || 5000);
   
    var input = hash;
    var output = "";
    var tab="./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    var order = [ 42, 21, 0,
                  1,  43, 22,
                  23, 2,  44,
                  45, 24, 3,
                  4,  46, 25,
                  26, 5,  47,
                  48, 27, 6,
                  7,  49, 28,
                  29, 8,  50,
                  51, 30, 9,
                  10, 52, 31,
                  32, 11, 53,
                  54, 33, 12,
                  13, 55, 34,
                  35, 14, 56,
                  57, 36, 15,
                  16, 58, 37,
                  38, 17, 59,
                  60, 39, 18,
                  19, 61, 40,
                  41, 20, 62,
                  63];
    for (i=0; i < input.length; i+=3) {
        // special case for the end of the input
        if (order[i+1] === undefined) {
            char_1 = input.charCodeAt(order[i+0]) & parseInt("00111111", 2);
            char_2 = (
                input.charCodeAt(order[i+0]) & parseInt("11000000", 2)) >>> 6;
            output += tab.charAt(char_1) + tab.charAt(char_2);
        } else {
            char_1 = input.charCodeAt(order[i+0]) & parseInt("00111111", 2);
            char_2 = (
                ((input.charCodeAt(order[i+0]) & parseInt("11000000", 2)) >>> 6) |
                    (input.charCodeAt(order[i+1]) & parseInt("00001111", 2)) << 2);
            char_3 = (
                ((input.charCodeAt(order[i+1]) & parseInt("11110000", 2)) >> 4) | 
                    (input.charCodeAt(order[i+2]) & parseInt("00000011", 2)) << 4);
            char_4 = (input.charCodeAt(order[i+2]) & parseInt("11111100", 2)) >>> 2;
            output += (tab.charAt(char_1) + tab.charAt(char_2) + 
                       tab.charAt(char_3) + tab.charAt(char_4));
        }
    }

    if(magic_array.length > 2) {
        magic = rounds ? "$6$rounds=" + rounds + "$" : "$6$";
    }

    return magic + salt + "$" + output;
}

if (typeof exports !== 'undefined') {
  exports._sha512crypt_intermediate = _sha512crypt_intermediate;
  exports._rstr_sha512crypt = _rstr_sha512crypt;
  exports.b64_sha512crypt = sha512crypt;
  exports.sha512crypt = sha512crypt;
}
