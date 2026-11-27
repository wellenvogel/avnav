import {default as generateLicense} from './collectLicense.mjs';

generateLicense().then((data)=>{
   console.log(data);
});