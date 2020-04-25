const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GObject = imports.gi.GObject;
const Clutter = imports.gi.Clutter;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const ConfirmDialog = Me.imports.confirmDialog;
const Utils = Me.imports.utils;

const Gettext = imports.gettext.domain("gnome-trash");
const _ = Gettext.gettext;

var ActionBar = GObject.registerClass(class ActionBar extends PopupMenu.PopupBaseMenuItem {
  _init() {
    super._init({
      activate: false,
      hover: false,
      style_class: 'gt-action-box',
    })

    this.actionsBox = new St.BoxLayout({
      vertical: false,
      style_class: 'gt-action-box-layout',
    });

    let open_btn = new PopupMenu.PopupBaseMenuItem();

    // Open trash button
    let open_icon = new St.Icon({
      icon_name: "folder-open-symbolic",
      style_class: 'popup-menu-icon'
    });

    let open_label = new St.Label({ text: _("Open Trash") });

    open_btn.add_child(open_icon);
    open_btn.add_child(open_label);
    open_btn.connect('activate', () => {
      this.onOpenTrash();
    });
    this.actionsBox.add(open_btn, { expand: true });


    let empty_btn = new PopupMenu.PopupBaseMenuItem();

    // Open trash button
    let empty_icon = new St.Icon({
      icon_name: "edit-delete-symbolic",
      style_class: 'popup-menu-icon',
    });

    let empty_label = new St.Label({ text: _("Empty Trash") });

    empty_btn.add_child(empty_label);
    empty_btn.add_child(empty_icon);
    empty_btn.connect('activate', () => {
      this.onEmptyTrash();
    });
    this.actionsBox.add(empty_btn, { expand: true });

    this.actor.add(this.actionsBox);
  }

  onEmptyTrash() {
    const title = _("Empty Trash?");
    const message = _("Are you sure you want to delete all items from the trash?");
    const sub_message = _("This operation cannot be undone.");

    ConfirmDialog.openConfirmDialog(title, message, sub_message, _("Empty"), { flag: ConfirmDialog.CONFIRM_ALWAYS_ASK }, this.doEmptyTrash.bind(this));
  }

  doEmptyTrash() {
    Utils.spawn_sync('gio', 'trash', '--empty');
  }

  onOpenTrash() {
    Utils.spawn_async('nautilus', 'trash:///');
  }
});