/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { FocusVisibleScrollView, FocusVisibleAction } from '@/components/common/FocusVisibleScrollView'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, RefreshControl, View } from 'react-native'
import Text from '@/components/common/Text'
import {
  EmptyState,
  Hairline,
  MagDialog,
  MagTopBar,
  OptionRow,
  PrimaryButton,
  SectionHeader,
  SettingRow,
  TextButton,
  UnderlineInput,
} from '@/components/magazine'
import { SettingsPage, SettingsSubpage, useSettingsTransition } from '@/components/common/SettingsPage'
import {
  adminApi,
  ensureAdminAccess,
  LuxAdminRequestError,
  type AdminInvite,
  type AdminStatusResponse,
  type AdminUserView,
} from '@/core/admin/api'
import { useI18n } from '@/lang'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { magType } from '@/theme/magazineType'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { confirmDialog, toast } from '@/utils/tools'
import { AdminMetricGrid } from './AdminMetricGrid'
import { useAdminConsoleStyles } from './useAdminConsoleStyles'

type AdminRouteName =
  | 'loading'
  | 'denied'
  | 'dashboard'
  | 'users'
  | 'invites'
  | 'playlists'
  | 'service'

interface AdminRoute {
  name: AdminRouteName
}

interface Props {
  visible: boolean
  onClose: () => void
  syncHost: string
  topPadding: number
  bottomDockHeight: number
}

export const AdminConsoleLayer = ({
  visible,
  onClose,
  syncHost,
  topPadding,
  bottomDockHeight,
}: Props) => {
  const t = useI18n()
  const styles = useAdminConsoleStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const closePage = useRef<() => void>(() => {})
  const { style: subpageStyle, requestOpen, requestClose, progress } = useSettingsTransition(false)
  useEffect(() => { progress.setValue(1) }, [progress])
  const [routeStack, setRouteStack] = useState<AdminRoute[]>([{ name: 'loading' }])
  const routeStackRef = useRef(routeStack)
  routeStackRef.current = routeStack
  const route = routeStack[routeStack.length - 1] ?? { name: 'loading' as const }
  const [token, setToken] = useState('')
  const [loginExpired, setLoginExpired] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [adminStatus, setAdminStatus] = useState<AdminStatusResponse | null>(null)
  const [serverName, setServerName] = useState<string | undefined>()
  const [users, setUsers] = useState<AdminUserView[]>([])
  const [userQuery, setUserQuery] = useState('')
  const [invites, setInvites] = useState<AdminInvite[]>([])
  const [playlists, setPlaylists] = useState<Awaited<ReturnType<typeof adminApi.mePlaylists>>['playlists'] | null>(null)
  const [revealedInviteCode, setRevealedInviteCode] = useState<string | null>(null)
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user')
  const [createInviteOpen, setCreateInviteOpen] = useState(false)
  const [inviteMaxUses, setInviteMaxUses] = useState('1')
  const [inviteRole, setInviteRole] = useState<'admin' | 'user'>('user')
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminUserView | null>(null)
  const [resetPasswordDraft, setResetPasswordDraft] = useState('')
  const [deleteUserTarget, setDeleteUserTarget] = useState<AdminUserView | null>(null)
  const [deleteUserConfirm, setDeleteUserConfirm] = useState('')

  const resetState = useCallback(() => {
    setRouteStack([{ name: 'loading' }])
    setToken('')
    setLoginExpired(false)
    setAdminStatus(null)
    setServerName(undefined)
    setUsers([])
    setUserQuery('')
    setInvites([])
    setPlaylists(null)
    setRevealedInviteCode(null)
  }, [])

  const runGate = useCallback(async() => {
    if (!syncHost) {
      setRouteStack([{ name: 'denied' }])
      return
    }
    const access = await ensureAdminAccess(syncHost)
    if (!access.ok) {
      setLoginExpired(access.reason == 'no_auth')
      setRouteStack([{ name: 'denied' }])
      return
    }
    setToken(access.token)
    setRouteStack([{ name: 'dashboard' }])
  }, [syncHost])

  useEffect(() => {
    if (!visible) {
      resetState()
      return
    }
    void runGate()
  }, [visible, runGate, resetState])

  const navigate = useCallback((next: AdminRoute) => {
    setRouteStack(stack => [...stack, next])
    requestOpen()
  }, [requestOpen])

  const handleBack = useCallback(() => {
    if (deleteUserTarget) {
      setDeleteUserTarget(null)
      setDeleteUserConfirm('')
      return
    }
    if (resetPasswordUser) {
      setResetPasswordUser(null)
      setResetPasswordDraft('')
      return
    }
    if (createUserOpen) {
      setCreateUserOpen(false)
      return
    }
    if (createInviteOpen) {
      setCreateInviteOpen(false)
      return
    }
    if (routeStackRef.current.length > 1) {
      requestClose(() => { setRouteStack(stack => stack.slice(0, -1)); progress.setValue(1) })
      return
    }
    closePage.current()
  }, [createInviteOpen, createUserOpen, deleteUserTarget, resetPasswordUser, requestClose, progress])

  useBackHandler(useCallback(() => {
    if (!visible) return false
    handleBack()
    return true
  }, [handleBack, visible]))

  const loadDashboard = useCallback(async() => {
    if (!token || !syncHost) return
    const [status, health] = await Promise.all([
      adminApi.status(syncHost, token),
      adminApi.health(syncHost, token).catch((): { ok: boolean, serverName?: string } => ({ ok: false })),
    ])
    setAdminStatus(status)
    setServerName(typeof health.serverName === 'string' ? health.serverName : undefined)
  }, [syncHost, token])

  const loadUsers = useCallback(async() => {
    if (!token || !syncHost) return
    const res = await adminApi.users(syncHost, token)
    setUsers(res.users)
  }, [syncHost, token])

  const loadInvites = useCallback(async() => {
    if (!token || !syncHost) return
    const res = await adminApi.invites(syncHost, token)
    setInvites(res.invites)
  }, [syncHost, token])

  const loadPlaylists = useCallback(async() => {
    if (!token || !syncHost) return
    const pl = await adminApi.mePlaylists(syncHost, token)
    setPlaylists(pl.playlists)
  }, [syncHost, token])

  const handleApiError = useCallback((err: unknown) => {
    if (err instanceof LuxAdminRequestError && (err.status === 401 || err.status === 403)) {
      setLoginExpired(err.status === 401)
      setToken('')
      setRouteStack([{ name: 'denied' }])
      return
    }
    toast(typeof (err as Error)?.message === 'string' ? (err as Error).message : t('admin_console_request_failed'))
  }, [t])

  useEffect(() => {
    if (!visible || !token) return
    if (route.name === 'dashboard') void loadDashboard().catch(handleApiError)
    if (route.name === 'users') void loadUsers().catch(handleApiError)
    if (route.name === 'invites') void loadInvites().catch(handleApiError)
    if (route.name === 'playlists') void loadPlaylists().catch(handleApiError)
    if (route.name === 'service') void loadDashboard().catch(handleApiError)
  }, [route.name, visible, token, loadDashboard, loadUsers, loadInvites, loadPlaylists, handleApiError])

  const onRefresh = async() => {
    setRefreshing(true)
    try {
      if (route.name === 'dashboard' || route.name === 'service') await loadDashboard()
      else if (route.name === 'users') await loadUsers()
      else if (route.name === 'invites') await loadInvites()
      else if (route.name === 'playlists') await loadPlaylists()
    } catch (err) {
      handleApiError(err)
    } finally {
      setRefreshing(false)
    }
  }

  const getPageTitle = (route: AdminRoute) => {
    switch (route.name) {
      case 'denied':
      case 'loading':
      case 'dashboard':
        return t('admin_console_title')
      case 'users':
        return t('admin_console_users_title')
      case 'invites':
        return t('admin_console_invites_title')
      case 'playlists':
        return t('admin_console_my_playlists')
      case 'service':
        return t('admin_console_service_title')
      default:
        return t('admin_console_title')
    }
  }

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter(u =>
      u.username.toLowerCase().includes(q) ||
      (u.displayName?.toLowerCase().includes(q) ?? false),
    )
  }, [userQuery, users])

  const deviceCountLabel = useMemo(() => {
    const count = adminStatus?.status.devices?.length
    if (typeof count === 'number') return String(count)
    return '—'
  }, [adminStatus])

  const serviceStatusLabel = adminStatus?.status.status
    ? t('admin_console_service_running')
    : t('admin_console_service_stopped')

  const handleConfirmDeleteUser = async() => {
    if (!deleteUserTarget || deleteUserConfirm.trim() !== deleteUserTarget.username) return
    try {
      await adminApi.deleteUser(syncHost, token, deleteUserTarget.id)
      setDeleteUserTarget(null)
      setDeleteUserConfirm('')
      await loadUsers()
      toast(t('admin_console_user_deleted'))
    } catch (err) {
      handleApiError(err)
    }
  }

  const handleToggleUserStatus = async(user: AdminUserView) => {
    const next = user.status === 'active' ? 'disabled' : 'active'
    const ok = await confirmDialog({
      title: t('admin_console_user_toggle_status_title'),
      message: next === 'disabled' ? t('admin_console_user_disable_confirm', { name: user.username }) : t('admin_console_user_enable_confirm', { name: user.username }),
    })
    if (!ok) return
    try {
      await adminApi.updateUser(syncHost, token, user.id, { status: next })
      await loadUsers()
      toast(t('admin_console_saved'))
    } catch (err) {
      handleApiError(err)
    }
  }

  const handleConfirmResetPassword = async() => {
    if (!resetPasswordUser || !resetPasswordDraft.trim()) return
    try {
      await adminApi.resetPassword(syncHost, token, resetPasswordUser.id, resetPasswordDraft.trim())
      setResetPasswordUser(null)
      setResetPasswordDraft('')
      toast(t('admin_console_saved'))
    } catch (err) {
      handleApiError(err)
    }
  }

  const handleCreateUser = async() => {
    if (!newUsername.trim() || !newPassword.trim()) {
      toast(t('admin_console_create_user_missing'))
      return
    }
    try {
      await adminApi.createUser(syncHost, token, {
        username: newUsername.trim(),
        password: newPassword.trim(),
        displayName: newDisplayName.trim() || undefined,
        role: newUserRole,
      })
      setCreateUserOpen(false)
      setNewUsername('')
      setNewPassword('')
      setNewDisplayName('')
      setNewUserRole('user')
      await loadUsers()
      toast(t('admin_console_saved'))
    } catch (err) {
      handleApiError(err)
    }
  }

  const handleCreateInvite = async() => {
    const maxUses = parseInt(inviteMaxUses, 10)
    if (!Number.isFinite(maxUses) || maxUses < 1) {
      toast(t('admin_console_invite_max_uses_invalid'))
      return
    }
    try {
      const res = await adminApi.createInvite(syncHost, token, { role: inviteRole, maxUses })
      setCreateInviteOpen(false)
      setInviteMaxUses('1')
      setInviteRole('user')
      setRevealedInviteCode(res.code)
      await loadInvites()
    } catch (err) {
      handleApiError(err)
    }
  }

  const handleToggleInvite = async(invite: AdminInvite) => {
    try {
      await adminApi.updateInvite(syncHost, token, invite.id, { disabled: !invite.disabled })
      await loadInvites()
    } catch (err) {
      handleApiError(err)
    }
  }

  const handleDeleteInvite = async(invite: AdminInvite) => {
    const ok = await confirmDialog({
      title: t('admin_console_invite_delete_title'),
      message: t('admin_console_invite_delete_confirm'),
    })
    if (!ok) return
    try {
      await adminApi.deleteInvite(syncHost, token, invite.id)
      await loadInvites()
    } catch (err) {
      handleApiError(err)
    }
  }

  const renderDenied = () => (
    <View style={styles.denyBody}>
      <Text size={magType.section.size} color={r.ink}>{t(loginExpired ? 'sync_lux_session_expired_title' : 'admin_console_denied_title')}</Text>
      <Text size={magType.body.size} color={r.muted}>{t(loginExpired ? 'sync_lux_session_expired_body' : 'admin_console_denied_subtitle')}</Text>
      {syncHost
        ? <Text size={magType.meta.size} color={r.quiet} style={styles.denyHost} numberOfLines={2}>{syncHost}</Text>
        : null}
      <View style={{ marginTop: 24 }}>
        <PrimaryButton label={t('back')} onPress={onClose} />
      </View>
    </View>
  )

  const renderDashboard = () => (
    <>
      <SectionHeader title={t('admin_console_overview')} showRule ruleGap={12} headGap={6} />
      <AdminMetricGrid
        items={[
          { key: 'users', label: t('admin_console_metric_users'), value: String(adminStatus?.users ?? '—') },
          { key: 'devices', label: t('admin_console_metric_devices'), value: deviceCountLabel },
          { key: 'service', label: t('admin_console_metric_service'), value: serviceStatusLabel },
          { key: 'invites', label: t('admin_console_metric_invites'), value: String(adminStatus?.invites ?? '—') },
        ]}
      />
      <SectionHeader title={t('admin_console_shortcuts')} showRule ruleGap={12} headGap={18} />
      <SettingRow icon="account-group-outline" iconBg={r.iconWrap.purple} title={t('admin_console_users_title')} onPress={() => { navigate({ name: 'users' }) }} />
      <SettingRow icon="ticket-confirmation-outline" iconBg={r.iconWrap.purple} title={t('admin_console_invites_title')} onPress={() => { navigate({ name: 'invites' }) }} />
      <SettingRow icon="folder-music-outline" iconBg={r.iconWrap.purple} title={t('admin_console_my_playlists')} onPress={() => { navigate({ name: 'playlists' }) }} />
      <SettingRow icon="server-outline" iconBg={r.iconWrap.purple} title={t('admin_console_service_title')} onPress={() => { navigate({ name: 'service' }) }} last />
    </>
  )

  const renderUsers = () => (
    <>
      <View style={styles.searchRow}>
        <UnderlineInput
          value={userQuery}
          onChangeText={setUserQuery}
          placeholder={t('admin_console_user_search_placeholder')}
          returnKeyType="search"
        />
      </View>
      <FocusVisibleAction><TextButton label={t('admin_console_create_user')} onPress={() => { setCreateUserOpen(true) }} /></FocusVisibleAction>
      {filteredUsers.length === 0
        ? <EmptyState title={t('admin_console_users_empty')} message={t('admin_console_users_empty_hint')} />
        : filteredUsers.map((user, index) => (
          <View key={user.id}>
            <View style={styles.userRow}>
              <View style={styles.userRowTop}>
                <Text size={magType.rowTitle.size} color={r.ink} numberOfLines={1}>{user.displayName ?? user.username}</Text>
                <Text size={magType.meta.size} color={r.muted} numberOfLines={1}>{user.username}</Text>
              </View>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: r.accentSoft }]}>
                  <Text size={magType.footnote.size} color={r.accentInk}>
                    {user.role === 'admin' ? t('admin_console_role_admin') : t('admin_console_role_user')}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: r.paperRaised }]}>
                  <Text size={magType.footnote.size} color={user.status === 'active' ? r.ink : r.danger}>
                    {user.status === 'active' ? t('admin_console_status_active') : t('admin_console_status_disabled')}
                  </Text>
                </View>
              </View>
              {user.source === 'managed'
                ? (
                  <View style={styles.inlineActions}>
                    <TextButton label={user.status === 'active' ? t('admin_console_disable_user') : t('admin_console_enable_user')} onPress={() => { void handleToggleUserStatus(user) }} />
                    <TextButton label={t('admin_console_reset_password')} onPress={() => { setResetPasswordUser(user); setResetPasswordDraft('') }} />
                    <TextButton
                      label={t('admin_console_delete_user')}
                      danger
                      onPress={() => { setDeleteUserTarget(user); setDeleteUserConfirm('') }}
                    />
                  </View>
                  )
                : (
                  <Text size={magType.meta.size} color={r.muted} style={{ marginTop: 6, lineHeight: 20 }}>
                    {t('admin_console_config_user_hint')}
                  </Text>
                  )}
            </View>
            {index < filteredUsers.length - 1 ? <Hairline /> : null}
          </View>
        ))}
    </>
  )

  const renderInvites = () => (
    <>
      <TextButton label={t('admin_console_create_invite')} onPress={() => { setCreateInviteOpen(true) }} />
      {revealedInviteCode
        ? (
          <View style={styles.detailBlock}>
            <Text size={magType.meta.size} color={r.muted}>{t('admin_console_invite_code_once')}</Text>
            <Text size={magType.section.size} color={r.ink} selectable>{revealedInviteCode}</Text>
          </View>
          )
        : null}
      {invites.length === 0
        ? <EmptyState title={t('admin_console_invites_empty')} message={t('admin_console_invites_empty_hint')} />
        : invites.map((invite, index) => (
          <View key={invite.id}>
            <View style={styles.inviteRow}>
              <Text size={magType.rowTitle.size} color={r.ink}>
                {t('admin_console_invite_uses', { used: invite.usedCount, max: invite.maxUses })}
              </Text>
              <Text size={magType.meta.size} color={r.muted}>
                {invite.role === 'admin' ? t('admin_console_role_admin') : t('admin_console_role_user')}
                {invite.disabled ? ` · ${t('admin_console_status_disabled')}` : ''}
              </Text>
              <View style={styles.inviteActions}>
                <TextButton label={invite.disabled ? t('admin_console_enable_user') : t('admin_console_disable_user')} onPress={() => { void handleToggleInvite(invite) }} />
                <TextButton label={t('admin_console_invite_delete')} onPress={() => { void handleDeleteInvite(invite) }} />
              </View>
            </View>
            {index < invites.length - 1 ? <Hairline /> : null}
          </View>
        ))}
    </>
  )

  const renderPlaylists = () => (
    <>
      <SectionHeader title={t('admin_console_my_playlists')} showRule ruleGap={12} headGap={18} />
      {playlists
        ? (
          <>
            {[playlists.defaultList, playlists.loveList, ...playlists.userList].map((pl, index, arr) => (
              <View key={`${pl.name}-${index}`}>
                <View style={styles.playlistRow}>
                  <Text size={magType.rowTitle.size} color={r.ink} numberOfLines={1}>{pl.name}</Text>
                  <Text size={magType.meta.size} color={r.muted}>{t('admin_console_playlist_songs', { count: pl.musicCount })}</Text>
                </View>
                {index < arr.length - 1 ? <Hairline /> : null}
              </View>
            ))}
          </>
          )
        : <Text size={magType.meta.size} color={r.muted}>{t('admin_console_playlists_loading')}</Text>}
    </>
  )

  const renderService = () => (
    <View style={styles.detailBlock}>
      <Text size={magType.meta.size} color={r.muted}>{t('admin_console_service_name')}</Text>
      <Text size={magType.rowTitle.size} color={r.ink}>{serverName ?? '—'}</Text>
      <Hairline />
      <Text size={magType.meta.size} color={r.muted}>{t('admin_console_metric_service')}</Text>
      <Text size={magType.rowTitle.size} color={r.ink}>{serviceStatusLabel}</Text>
      {adminStatus?.status.message
        ? (
          <>
            <Text size={magType.meta.size} color={r.muted}>{t('admin_console_service_message')}</Text>
            <Text size={magType.body.size} color={r.list}>{adminStatus.status.message}</Text>
          </>
          )
        : null}
      {adminStatus?.status.address?.length
        ? (
          <>
            <Text size={magType.meta.size} color={r.muted}>{t('admin_console_service_addresses')}</Text>
            {adminStatus.status.address.map(addr => (
              <Text key={addr} size={magType.body.size} color={r.list}>{addr}</Text>
            ))}
          </>
          )
        : null}
      <Text size={magType.meta.size} color={r.muted}>{t('admin_console_service_managed_users')}</Text>
      <Text size={magType.rowTitle.size} color={r.ink}>{String(adminStatus?.managedUsers ?? '—')}</Text>
    </View>
  )

  const renderBody = (route: AdminRoute) => {
    switch (route.name) {
      case 'loading':
        return (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={r.ink} />
          </View>
        )
      case 'denied':
        return renderDenied()
      case 'dashboard':
        return renderDashboard()
      case 'users':
        return renderUsers()
      case 'invites':
        return renderInvites()
      case 'playlists':
        return renderPlaylists()
      case 'service':
        return renderService()
      default:
        return null
    }
  }

  return (
    <>
      <SettingsPage visible={visible} onBack={onClose} bottomInset={bottomDockHeight} hardwareBack={false}>
        {back => {
          closePage.current = back
          return <SettingsSubpage pages={routeStack} style={subpageStyle}>{route =>
        <FocusVisibleScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: 18 }]}
          showsVerticalScrollIndicator={false}
          bounces
          refreshControl={
            route.name !== 'loading' && route.name !== 'denied'
              ? <RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh() }} tintColor={r.ink} />
              : undefined
          }
        >
          <MagTopBar onBack={handleBack} />
          <Text size={magType.h2.size} color={r.display} style={styles.subpageTitle}>{getPageTitle(route)}</Text>
          {renderBody(route)}
        </FocusVisibleScrollView>
          }</SettingsSubpage>
        }}
      </SettingsPage>

      <MagDialog visible={createUserOpen} title={t('admin_console_create_user')} onClose={() => { setCreateUserOpen(false) }}>
        <UnderlineInput value={newUsername} onChangeText={setNewUsername} placeholder={t('admin_console_username_placeholder')} />
        <UnderlineInput value={newPassword} onChangeText={setNewPassword} placeholder={t('admin_console_password_placeholder')} secureTextEntry />
        <UnderlineInput value={newDisplayName} onChangeText={setNewDisplayName} placeholder={t('admin_console_display_name_placeholder')} />
        <OptionRow label={t('admin_console_role_user')} selected={newUserRole === 'user'} onPress={() => { setNewUserRole('user') }} />
        <OptionRow label={t('admin_console_role_admin')} selected={newUserRole === 'admin'} onPress={() => { setNewUserRole('admin') }} last />
        <PrimaryButton label={t('agree')} onPress={() => { void handleCreateUser() }} />
      </MagDialog>

      <MagDialog visible={createInviteOpen} title={t('admin_console_create_invite')} onClose={() => { setCreateInviteOpen(false) }}>
        <UnderlineInput value={inviteMaxUses} onChangeText={setInviteMaxUses} placeholder={t('admin_console_invite_max_uses_placeholder')} keyboardType="number-pad" />
        <OptionRow label={t('admin_console_role_user')} selected={inviteRole === 'user'} onPress={() => { setInviteRole('user') }} />
        <OptionRow label={t('admin_console_role_admin')} selected={inviteRole === 'admin'} onPress={() => { setInviteRole('admin') }} last />
        <PrimaryButton label={t('agree')} onPress={() => { void handleCreateInvite() }} />
      </MagDialog>

      <MagDialog
        visible={resetPasswordUser != null}
        title={t('admin_console_reset_password_title')}
        message={resetPasswordUser ? t('admin_console_reset_password_message', { name: resetPasswordUser.username }) : undefined}
        onClose={() => { setResetPasswordUser(null); setResetPasswordDraft('') }}
      >
        <UnderlineInput
          value={resetPasswordDraft}
          onChangeText={setResetPasswordDraft}
          placeholder={t('admin_console_new_password_placeholder')}
          secureTextEntry
        />
        <PrimaryButton label={t('agree')} onPress={() => { void handleConfirmResetPassword() }} />
      </MagDialog>

      <MagDialog
        visible={deleteUserTarget != null}
        eyebrowDanger
        title={t('admin_console_user_delete_title')}
        message={deleteUserTarget ? t('admin_console_user_delete_warning', { name: deleteUserTarget.username }) : undefined}
        cancelLabel={t('cancel')}
        confirmLabel={t('admin_console_delete_user')}
        confirmDanger
        confirmDisabled={!deleteUserTarget || deleteUserConfirm.trim() !== deleteUserTarget.username}
        onClose={() => { setDeleteUserTarget(null); setDeleteUserConfirm('') }}
        onCancel={() => { setDeleteUserTarget(null); setDeleteUserConfirm('') }}
        onConfirm={() => { void handleConfirmDeleteUser() }}
      >
        <UnderlineInput
          value={deleteUserConfirm}
          onChangeText={setDeleteUserConfirm}
          placeholder={deleteUserTarget ? t('admin_console_user_delete_confirm_placeholder', { name: deleteUserTarget.username }) : undefined}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </MagDialog>
    </>
  )
}
