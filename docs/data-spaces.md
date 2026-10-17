# PR 5.2: local data spaces (storage only)

`getActiveSpace()` returns `local` or `lux:<serverId>:<userId>`. Components of Lux IDs are URI encoded to prevent delimiter collisions. `setActiveSpace()` persists the active ID and serializes switches. `listSpaces()` returns ID, kind, optional account username, and lastActiveAt. Successful Lux credential persistence selects that account before list/profile sync. Logout retains the active ID and data; saved credentials alone are not proof of login. Startup uses the existing `syncLoginCompleted` flag plus Lux mode and authenticated server/user IDs. Otherwise it restores the saved space after the initial migration. A logged-in legacy Lux session without serverId stops startup before migration rather than guessing an account identity.

All `plugins/storage` single/batch reads, writes and removals resolve affected base keys to `<baseKey>@<spaceId>` at entry. Explicit physical keys stay pinned across awaits. Enumeration presents current-space base keys and globals, excluding retained legacy roots and other spaces. Playlist caches reload on switches, history flushes the pending snapshot to its original physical key before loading the new space, cursors reset, and listening sessions restart. Profile scalar caches were removed; list metadata updates are serialized per physical key instead of retaining global caches and delayed writes.

Migration runs before settings/player/list initialization. It reads affected legacy roots plus every referenced shard, writes a timestamped raw backup in verified 250,000-character chunks, then publishes and reads back `dataSpaceBackup@v1`. Only after this succeeds does it copy destinations. Fragmented values get independent destination shards, verified before publishing their root. Existing destination roots are preserved, and referenced shards must exist. It writes and verifies `dataSpaceMigration=v1:<target>` last. Restart reuses the completed backup and its original target; incomplete backup chunks can be rewritten because no destination copy has started. Legacy roots/shards are never removed. A backup, shard, write, or verification error aborts startup rather than proceeding with an empty store. Logs include begin, verified backup/resume, each copied/skipped root, and completion.

## Storage inventory

| Key / family | Scope after this PR |
| --- | --- |
| `@user_list` | Per space |
| `@list__<id>` (including default, love, temp, custom lists) | Per space |
| `@list_scroll_position`, `@list_prev_select_id`, `@list_update_info` | Per space |
| `@play_info` | Per space |
| `@dislike_list` | Per space |
| `@play_history`, `@play_history_cursor` (cursor + acked IDs + server/user identity) | Per space |
| `@user_name`, `@user_signature`, `@user_gender` | Per space |
| `@sync_conflict_mode` | Per space |
| `@___PART_A___<physical-key><index>` | Follows the owning root; migrated shards are independent |
| Retained legacy roots, `@___PART___…` / old array shards | Unmodified migration source, no runtime fallback |
| `@setting_v1`, `@font_size`, `@theme`, `lux.theme.id` | Global settings/theme |
| `@view_prev_state`, `@search_history_list`, `@search_setting`, `@songist_setting`, `@leaderboard_setting` | Global application preferences/history |
| `@stats_chart_mode`, `@stats_page_style` | Global appearance preferences |
| `@play_history_device`, `@sync_device_id` | Global device identities |
| `@sync_host`, `@sync_host_history`, `@sync_mode`, `@sync_login_completed` | Global connection/login selection |
| `@sync_auth_key`, `@lux_auth`, `@lux_auth_servers`, `@sync_login_draft` | Global credential stores; existing server/account indexing unchanged |
| `@open_storage_path`, `@selected_managed_folder` | Global device filesystem selection |
| `@notification_tip_enable`, `@ignoring_battery_optimization_tip_enable`, `@ignore_version_fail_tip_time`, `@cheat_tip`, `@remote_lyric_tip` | Global app notices |
| `@user_api__` and `@user_api__<id>` | Global custom source configuration/scripts |
| `@lyric__<id>` / edited suffix, `@music_url__<id>_<quality>`, `@music_other_source__<id>` | Global music caches |
| `@audio_cache_index`, `@local_song_library` | Global device audio cache/imported filesystem catalog |
| `@play_history_avatars`, `lx_playlist_cover_urls`, `lx_cover_failure_registry`, `lx_local_song_cover_cache` | Global artwork/lookup caches |
| `lux.togetherDebugPanel` | Global debug preference |
| `@user_avatar` and private `user/avatar.{jpg,jpeg,png,webp,bmp}` | Global — NEEDS_DECISION below |
| Obsolete `@setting`, `@listposition__`, `@listsort__` | Existing pre-v1 migration inputs, still global |
| `dataSpaceActive`, `dataSpaceSpaces`, `dataSpaceMigration` | Global space registry/control |
| `dataSpaceBackup@v1`, `dataSpaceBackup@v1:chunk:<index>` | Global immutable completed migration backup |

## NEEDS_DECISION: avatar files

`src/utils/data.ts` stores `@user_avatar` as a path/URL and copies local images to one shared `privateStorageDirectoryPath/user/avatar.<ext>`. Both local selection and profile sync can overwrite that file and delete all other supported extensions. Namespacing only the key would let one account destroy another account's avatar; a safe change needs a separate file migration/backup policy and a decision on how legacy shared avatar bytes are owned. Per the task's explicit fallback, this PR leaves BOTH the avatar key and avatar file operations global. Name, gender, signature are isolated. Shared avatars remain a known isolation exception until that decision.

## List sync snapshots/cursors audit

No client-persisted list sync snapshot or list sync cursor key/file was found. `src/plugins/sync/constants.ts` declares `list/snapshot`, `dislike/snapshot`, and `snapshotInfo.json`, but no mobile storage reader/writer uses these constants. The mobile list sync handlers compute MD5 from the current lists and negotiate merge mode; persisted list contents and merge mode are now isolated. `play_history_cursor` is the actual persisted sync cursor and is isolated. No speculative snapshot format/path migration was added.

UI changes: none added, removed, hidden, moved, or restyled. No new page, user-facing copy, version change, or commit.
