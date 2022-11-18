# Gnome Trash (Forked from b00f/gnome-trash)

A gnome shell extension to manage your **Gnome Trash**.

It allows you to manage the trash items and empty or open the Trash folder. It lists the files in the trash bin in the panel menu.

Note: This extension is only shows items under home trash folder(`~/.local/share/Trash`).

Forked and modified to allow gnome-shell 43.

## Installation
### From source code

Before compiling the code make sure you have installed Typescript.

A `Makefile` is included. Then all you have to do is run the command below
```
git clone https://github.com/michaelgosing/gnome-trash.git
cd gnome-trash
make install
```

If you are going to test your changes, run: `make test`.
It automatically installs the extension and restart the gnome-shell.

You can run `make test_wayland` to test this extension on [wayland](https://wayland.freedesktop.org/).


