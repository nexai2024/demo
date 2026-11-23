# Vendored runtime libraries

`lib/libatomic.so.1` — x86-64 ELF shared library from Debian's
`libatomic1 14.2.0-19` package (GCC runtime library; GPLv3 with the GCC
Runtime Library Exception).

Why it is here: Playwright's bundled Node.js driver binary links against
`libatomic.so.1`, which is absent from minimal serverless images such as
Amazon Linux 2023 (Vercel's Python runtime). Without it the driver dies at
load time and every browser call failed with "Connection closed while
reading from the driver". `engine.py` prepends this directory to
`LD_LIBRARY_PATH` on Linux before starting the driver. Verified on
`amazonlinux:2023`: the driver fails without it and starts cleanly with
it, with all other libraries (`libstdc++`, `libgcc_s`, glibc) resolved
from the system. The library only requires GLIBC_2.14 or older symbols,
so it is safe on any modern glibc host.
