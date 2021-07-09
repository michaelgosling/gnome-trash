// @ts-ignore
const Me = imports.misc.extensionUtils.getCurrentExtension();

import * as TrashMenu from 'trashMenu';
import * as SearchBox from 'searchBox';
import * as ActionBar from 'actionBar';
import * as TrashItem from 'trashItem';
import * as Settings from 'settings';
import * as ConfirmDialog from 'confirmDialog';
import * as log from 'log';
import * as utils from 'utils';

const Mainloop = imports.mainloop;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const { St, GObject, Gio, GLib } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const ByteArray = imports.byteArray;

export const TrashPanel = GObject.registerClass(
  class TrashPanel extends PanelMenu.Button {
    private _trashPath: string = "";
    // @ts-ignore
    private _trashMenu: TrashMenu.TrashMenu;
    private _monitorChangeID = 0;
    // @ts-ignore
    private _trash: Map<string, TrashItem.TrashItem>;
    // @ts-ignore
    private _settings: Settings.ExtensionSettings;

    protected _init() {
      this._trash = new Map<string, TrashItem.TrashItem>();
      this._settings = new Settings.ExtensionSettings();

      super._init(0.0, _("Gnome Trash"));
      this.trashIcon = new St.Icon({
        icon_name: 'user-trash-full-symbolic',
        style_class: 'popup-menu-icon'
      })
      this.add_actor(this.trashIcon);

      this._trashPath = GLib.get_home_dir() + '/.local/share/Trash/';
      let trashDir = Gio.file_new_for_path(this._trashPath);
      if (!trashDir.query_exists(null)) {
        Main.notifyError(_("Gnome-trash failed to start"), _("No trash folder is detected."));
      }

      this._setupPanel();
      this._setupMonitor();

      // Clear search when re-open the menu and set focus on search box
      this._openStateChangedID = this._trashMenu.connect('open-state-changed', (_widget: any, open: boolean) => {
        log.debug("open-state-changed event");
        if (open) {
          let t = Mainloop.timeout_add(50, () => {
            this._searchBox.setText('');

            // Don't invoke timer again
            Mainloop.source_remove(t);
            return false;
          });
        }
      });

      this._keyPressEventID = this._trashMenu.scrollView.connect('key-press-event', (_widget: any, _event: any, _data: any) => {
        log.debug("key-press event");

        global.stage.set_key_focus(this._searchBox.searchEntry);
      });

      this._actionBar.onOpenSettings(() => {
        ExtensionUtils.openPrefs();
      })

      this._settings.onChanged(this._onSettingsChanged.bind(this));
      this._actionBar.onEmptyTrash(this._onEmptyTrash.bind(this));
      this._actionBar.onOpenTrash(this._onOpenTrash.bind(this));
      this._searchBox.onTextChanged(this._onSearch.bind(this));
      this._onTrashChange();
    }

    private _setupPanel() {
      this.menu.box.style_class = 'popup-menu-content gnome-trash';

      this._searchBox = new SearchBox.SearchBox();
      this.menu.addMenuItem(this._searchBox);

      let separator1 = new PopupMenu.PopupSeparatorMenuItem();
      this.menu.addMenuItem(separator1);

      this._trashMenu = new TrashMenu.TrashMenu(this._settings);
      this.menu.addMenuItem(this._trashMenu);

      let separator2 = new PopupMenu.PopupSeparatorMenuItem();
      this.menu.addMenuItem(separator2);

      this._actionBar = new ActionBar.ActionBar(this);
      this.menu.addMenuItem(this._actionBar);
    }

    private _onSearch() {
      let query = this._searchBox.getText().toLowerCase();
      this._trashMenu.filterItems(query);
    }

    private _setupMonitor() {
      let infoDir = Gio.file_new_for_path(this._trashPath + 'info/');
      this._monitor = infoDir.monitor_directory(0, null);
      this._monitorChangeID = this._monitor.connect('changed', this._onTrashChange.bind(this));
    }

    private _onTrashChange() {
      log.info(`Trash has changed`);

      // By Deleting a file, this function calls several times.
      let hasChanged = false;
      let trashFilesPath = this._trashPath + 'files/';
      let trashInfoPath = this._trashPath + 'info/';
      try {
        let dir = Gio.file_new_for_path(trashFilesPath);
        if (!dir.query_exists(null)) {
          return;
        }
        let children = dir.enumerate_children('*', 0, null);
        let fileInfo = null;

        while ((fileInfo = children.next_file(null)) != null) {
          let filename = fileInfo.get_name();
          if (this._trash.has(filename)) {
            continue;
          }

          let trashPath = trashFilesPath + fileInfo.get_name();
          let infoPath = trashInfoPath + fileInfo.get_name() + ".trashinfo";
          let [ok, info] = GLib.file_get_contents(infoPath);
          if (!ok) {
            log.error(`unable to get contents of ${infoPath}`);
            continue;
          }

          let lines = ByteArray.toString(info).split('\n');
          if (lines[0] != '[Trash Info]') {
            log.error(`unable to get contents of ${infoPath}`);
          }


          let pathLine = lines[1].split('=');
          let dateLine = lines[2].split('=');

          let restorePath = unescape(pathLine[1])
          let deleteAt = GLib.DateTime.new_from_iso8601(dateLine[1], null);

          let trashItem = new TrashItem.TrashItem(
            fileInfo.get_symbolic_icon(),
            filename,
            trashPath,
            infoPath,
            deleteAt,
            restorePath);

          log.debug(`adding ${trashPath}`)
          this._trash.set(filename, trashItem);
          hasChanged = true;
        }
        children.close(null)
      } catch (err) {
        log.error(`an exception occurred ${err}`);
      }

      if (hasChanged) {
        this._rebuildMenu();
        if (this._trash.size == 0) {
          this.trashIcon.icon_name = "user-trash-empty-symbolic";
        } else {
          this.trashIcon.icon_name = "user-trash-full-symbolic"
        }

      }
    }

    private _rebuildMenu() {
      let arr = Array.from(this._trash.values());
      let trashSort = this._settings.trashSort();
      arr.sort(function (l: TrashItem.TrashItem, r: TrashItem.TrashItem): number {
        switch (trashSort) {
          case Settings.TRASH_SORT_FILE_NAME:
            return l.filename.localeCompare(r.filename);

          case Settings.TRASH_SORT_DELETE_TIME:
            return r.deletedAt - l.deletedAt;

          default:
            log.error(`invalid sort ${trashSort}`)
            return 0;
        }
      });

      this._trashMenu.rebuildMenu(arr);
      this._onSearch();
    }

    private _onSettingsChanged() {
      log.info("settings changed");

      this._rebuildMenu();
    }

    private _onEmptyTrash() {
      const title = _("Empty Trash?");
      const message = _("Are you sure you want to delete all items from the trash?");
      const sub_message = _("This operation cannot be undone.");

      ConfirmDialog.openConfirmDialog(title, message, sub_message, this._doEmptyTrash.bind(this), _("Empty"));
    }

    private _doEmptyTrash() {
      utils.spawnSync('gio', 'trash', '--empty');
    }

    private _onOpenTrash() {
      utils.spawnAsync('nautilus', 'trash:///');
    }

    private _toggle() {
      this.menu.toggle();
    }

    public destroy() {
      if (this._monitorChangeID) {
        this._monitor.disconnect(this._monitorChangeID);
        this._monitorChangeID = 0;
      }
      if (this._openStateChangedID) {
        this._trashMenu.disconnect(this._openStateChangedID);
        this._openStateChangedID = 0;
      }
      if (this._keyPressEventID) {
        this._trashMenu.scrollView.disconnect(this._keyPressEventID);
        this._keyPressEventID = 0;
      }

      super.destroy();
    }
  }
);
