(() => {
  const loginView = document.getElementById('loginView');
  const chatView = document.getElementById('chatView');
  const mobileRoomsBtn = document.getElementById('mobileRoomsBtn');
  const mobileNavOverlay = document.getElementById('mobileNavOverlay');
  const loginForm = document.getElementById('loginForm');

  // Capacitor / Android: Paarrot-style edge-to-edge + themed safe-area padding.
  void (async function bootNativeChrome() {
    try {
      const cap = window.Capacitor;
      const native =
        Boolean(cap?.isNativePlatform?.()) ||
        location.protocol === 'capacitor:' ||
        localStorage.getItem('kitsu.standalone') === '1';
      if (!native) return;

      const root = document.documentElement;
      root.classList.add('is-native-app', 'android-capacitor');
      document.body?.classList.add('is-native-app', 'android-capacitor');

      // Safe-area CSS vars (env() is often 0px in Android WebView — Paarrot fallback).
      root.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top, 0px)');
      root.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom, 0px)');
      root.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left, 0px)');
      root.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right, 0px)');
      requestAnimationFrame(() => {
        const top = getComputedStyle(root).getPropertyValue('--safe-area-inset-top').trim();
        const envWorking = top && top !== '0px' && top !== '0';
        const android = Boolean(cap?.getPlatform?.() === 'android' || /Android/i.test(navigator.userAgent));
        if (!envWorking && android) {
          root.style.setProperty('--safe-area-inset-top', '28px');
          root.style.setProperty('--safe-area-inset-bottom', '24px');
        }
      });

      const StatusBar = cap?.Plugins?.StatusBar;
      if (StatusBar) {
        await StatusBar.setOverlaysWebView?.({ overlay: true });
        await StatusBar.setStyle?.({ style: 'DARK' });
        await StatusBar.show?.();
      }
    } catch (error) {
      console.warn('[kitsu] status bar boot', error);
    }
  })();
  const loginError = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');

  const scriptLoaders = new Map();
  function loadScriptOnce(src) {
    if (scriptLoaders.has(src)) return scriptLoaders.get(src);
    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-relay-src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.dataset.relaySrc = src;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(el);
    });
    scriptLoaders.set(src, promise);
    return promise;
  }

  async function ensureMarkdown() {
    if (window.RelayMarkdown?.renderMessage) return window.RelayMarkdown;
    await loadScriptOnce('/vendor/relay-markdown.js');
    return window.RelayMarkdown;
  }

  async function ensureLiveKit() {
    if (window.RelayLiveKit) return window.RelayLiveKit;
    await loadScriptOnce('/vendor/relay-livekit.js');
    return window.RelayLiveKit;
  }

  // Restore session UI as early as possible so a later boot error can't leave the login screen stuck.
  void (async function earlySessionRestore() {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const res = await fetch('/api/session');
        const session = await res.json().catch(() => ({}));
        // Only flip to chat once Matrix is actually ready (or still restoring).
        if (session?.ready || (session?.connected && session?.restoring)) {
          if (loginView) loginView.hidden = true;
          if (chatView) chatView.hidden = false;
          console.info(
            '[relay] early session restore:',
            session.ready ? 'ready' : 'restoring',
            session.userId || '',
          );
          return;
        }
      } catch (error) {
        console.warn('[relay] early session restore wait', error?.message || error);
      }
      await new Promise((resolve) => setTimeout(resolve, attempt < 8 ? 50 : 120));
    }
  })();
  const settingsThemePicker = document.getElementById('settingsThemePicker');
  const roomList = document.getElementById('roomList');
  const messageList = document.getElementById('messageList');
  const jumpToLatestBtn = document.getElementById('jumpToLatestBtn');
  const typingIndicator = document.getElementById('typingIndicator');
  const activeRoomName = document.getElementById('activeRoomName');
  const activeRoomAvatar = document.getElementById('activeRoomAvatar');
  const activeRoomAvatarFallback = document.getElementById('activeRoomAvatarFallback');
  const spaceFilterLabel = document.getElementById('spaceFilterLabel');
  const spaceBackBtn = document.getElementById('spaceBackBtn');
  const composerForm = document.getElementById('composerForm');
  const composerInput = document.getElementById('composerInput');
  const composerReplyBar = document.getElementById('composerReplyBar');
  const composerReplyLabel = document.getElementById('composerReplyLabel');
  const composerReplyPreview = document.getElementById('composerReplyPreview');
  const composerReplyCancel = document.getElementById('composerReplyCancel');
  const composerEditBar = document.getElementById('composerEditBar');
  const composerEditPreview = document.getElementById('composerEditPreview');
  const composerEditCancel = document.getElementById('composerEditCancel');
  const messageReactRow = document.getElementById('messageReactRow');
  const messagePinLabel = document.getElementById('messagePinLabel');
  const messageSourceDialog = document.getElementById('messageSourceDialog');
  const messageSourceBody = document.getElementById('messageSourceBody');
  const messageReceiptsDialog = document.getElementById('messageReceiptsDialog');
  const messageReceiptsList = document.getElementById('messageReceiptsList');
  const composerMentions = document.getElementById('composerMentions');
  const composerAttachBtn = document.getElementById('composerAttachBtn');
  const composerMarkdownBtn = document.getElementById('composerMarkdownBtn');
  const composerEmojiBtn = document.getElementById('composerEmojiBtn');
  const composerGifBtn = document.getElementById('composerGifBtn');
  const composerMarkdownBar = document.getElementById('composerMarkdownBar');
  const composerPicker = document.getElementById('composerPicker');
  const composerPickerBody = document.getElementById('composerPickerBody');
  const composerPickerSearch = document.getElementById('composerPickerSearch');
  const composerPickerSidebar = document.getElementById('composerPickerSidebar');
  const composerPickerPreview = document.getElementById('composerPickerPreview');
  const composerPickerPreviewEmoji = document.getElementById('composerPickerPreviewEmoji');
  const composerPickerPreviewCode = document.getElementById('composerPickerPreviewCode');
  const composerFile = document.getElementById('composerFile');
  const composerAttachPreview = document.getElementById('composerAttachPreview');
  const composerDropHint = document.getElementById('composerDropHint');
  const imageLightbox = document.getElementById('imageLightbox');
  const imageLightboxImg = document.getElementById('imageLightboxImg');
  const imageLightboxStage = document.getElementById('imageLightboxStage');
  const imageLightboxName = document.getElementById('imageLightboxName');
  const imageLightboxDownload = document.getElementById('imageLightboxDownload');
  const imageLightboxClose = document.getElementById('imageLightboxClose');
  const imageLightboxZoomIn = document.getElementById('imageLightboxZoomIn');
  const imageLightboxZoomOut = document.getElementById('imageLightboxZoomOut');
  const imageLightboxZoomLabel = document.getElementById('imageLightboxZoomLabel');
  const workspaceRail = document.getElementById('workspaceRail');
  const spaceRailList = document.getElementById('spaceRailList');
  const spaceContextMenu = document.getElementById('spaceContextMenu');
  const folderContextMenu = document.getElementById('folderContextMenu');
  const roomContextMenu = document.getElementById('roomContextMenu');
  const messageContextMenu = document.getElementById('messageContextMenu');
  const roomSettingsDialog = document.getElementById('roomSettingsDialog');
  const roomSettingsForm = document.getElementById('roomSettingsForm');
  const roomSettingsTitle = document.getElementById('roomSettingsTitle');
  const roomSettingsMeta = document.getElementById('roomSettingsMeta');
  const roomSettingsId = document.getElementById('roomSettingsId');
  const roomSettingsLink = document.getElementById('roomSettingsLink');
  const userProfileCard = document.getElementById('userProfileCard');
  const userProfileBanner = document.getElementById('userProfileBanner');
  const userProfileBannerImg = document.getElementById('userProfileBannerImg');
  const userProfileAvatar = document.getElementById('userProfileAvatar');
  const userProfileAvatarFallback = document.getElementById('userProfileAvatarFallback');
  const userProfileOnline = document.getElementById('userProfileOnline');
  const userProfileName = document.getElementById('userProfileName');
  const userProfileId = document.getElementById('userProfileId');
  const userProfileStatus = document.getElementById('userProfileStatus');
  const userProfileServer = document.getElementById('userProfileServer');
  const userProfileShareBtn = document.getElementById('userProfileShareBtn');
  const userProfileRole = document.getElementById('userProfileRole');
  const userProfileMessageBtn = document.getElementById('userProfileMessageBtn');
  const userProfileMoreBtn = document.getElementById('userProfileMoreBtn');
  const showHiddenSpacesBtn = document.getElementById('showHiddenSpacesBtn');
  const railAddBtn = document.getElementById('railAddBtn');
  const railAddMenu = document.getElementById('railAddMenu');
  const railSearchBtn = document.getElementById('railSearchBtn');
  const quickSwitcher = document.getElementById('quickSwitcher');
  const quickSwitcherInput = document.getElementById('quickSwitcherInput');
  const quickSwitcherResults = document.getElementById('quickSwitcherResults');
  const createSpaceDialog = document.getElementById('createSpaceDialog');
  const createSpaceForm = document.getElementById('createSpaceForm');
  const createSpaceName = document.getElementById('createSpaceName');
  const createSpaceTopic = document.getElementById('createSpaceTopic');
  const createSpaceError = document.getElementById('createSpaceError');
  const createSpaceCancel = document.getElementById('createSpaceCancel');
  const createSpaceFederation = document.getElementById('createSpaceFederation');
  const createSpaceAdvanceToggle = document.getElementById('createSpaceAdvanceToggle');
  const createSpaceAdvanceOptions = document.getElementById('createSpaceAdvanceOptions');
  const createSpaceType = document.getElementById('createSpaceType');
  const createSpaceTypeBtn = document.getElementById('createSpaceTypeBtn');
  const createSpaceTypeLabel = document.getElementById('createSpaceTypeLabel');
  const createSpaceTypeMenu = document.getElementById('createSpaceTypeMenu');
  const createSpaceNamePrefix = document.getElementById('createSpaceNamePrefix');
  const railAccountBtn = document.getElementById('railAccountBtn');
  const railSecurityBtn = document.getElementById('railSecurityBtn');
  const railSecurityBadge = document.getElementById('railSecurityBadge');
  const railAccountOrb = document.getElementById('railAccountOrb');
  const accountMenu = document.getElementById('accountMenu');
  const accountMenuName = document.getElementById('accountMenuName');
  const accountMenuId = document.getElementById('accountMenuId');
  const chatMain = document.getElementById('chatMain');
  const settingsView = document.getElementById('settingsView');
  const settingsSessionUser = document.getElementById('settingsSessionUser');
  const settingsSessionHomeserver = document.getElementById('settingsSessionHomeserver');
  const settingsNavLogoutBtn = document.getElementById('settingsNavLogoutBtn');
  const settingsVersion = document.getElementById('settingsVersion');
  const settingsPluginList = document.getElementById('settingsPluginList');
  const accountPreviewBanner = document.getElementById('accountPreviewBanner');
  const accountPreviewBannerImg = document.getElementById('accountPreviewBannerImg');
  const accountPreviewAvatar = document.getElementById('accountPreviewAvatar');
  const accountPreviewAvatarFallback = document.getElementById('accountPreviewAvatarFallback');
  const accountPreviewName = document.getElementById('accountPreviewName');
  const accountPreviewId = document.getElementById('accountPreviewId');
  const accountPreviewOnline = document.getElementById('accountPreviewOnline');
  const accountStatusBtn = document.getElementById('accountStatusBtn');
  const accountPreviewServer = document.getElementById('accountPreviewServer');
  const accountPreviewShareBtn = document.getElementById('accountPreviewShareBtn');
  const accountPreviewRole = document.getElementById('accountPreviewRole');
  const accountMatrixId = document.getElementById('accountMatrixId');
  const accountCopyIdBtn = document.getElementById('accountCopyIdBtn');
  const accountEmail = document.getElementById('accountEmail');
  const accountDisplayNameInput = document.getElementById('accountDisplayNameInput');
  const accountDisplayNameSaveBtn = document.getElementById('accountDisplayNameSaveBtn');
  const accountAvatarFile = document.getElementById('accountAvatarFile');
  const accountBannerFile = document.getElementById('accountBannerFile');
  const styleBorderColor = document.getElementById('styleBorderColor');
  const styleBorderAlpha = document.getElementById('styleBorderAlpha');
  const styleGradStart = document.getElementById('styleGradStart');
  const styleGradEnd = document.getElementById('styleGradEnd');
  const styleGradAngle = document.getElementById('styleGradAngle');
  const styleGradAngleLabel = document.getElementById('styleGradAngleLabel');
  const styleGradPreview = document.getElementById('styleGradPreview');
  const styleSaveBtn = document.getElementById('styleSaveBtn');
  const styleRemoveBtn = document.getElementById('styleRemoveBtn');
  const styleNameGradStart = document.getElementById('styleNameGradStart');
  const styleNameGradEnd = document.getElementById('styleNameGradEnd');
  const styleNamePreviewPlate = document.getElementById('styleNamePreviewPlate');
  const styleNamePreviewText = document.getElementById('styleNamePreviewText');
  const nameplatePicker = document.getElementById('nameplatePicker');
  const blockUserInput = document.getElementById('blockUserInput');
  const blockUserBtn = document.getElementById('blockUserBtn');
  const blockedUserList = document.getElementById('blockedUserList');
  const spaceSettingsDialog = document.getElementById('spaceSettingsDialog');
  const spaceSettingsTitle = document.getElementById('spaceSettingsTitle');
  const spaceSettingsTopic = document.getElementById('spaceSettingsTopic');
  const spaceSettingsId = document.getElementById('spaceSettingsId');
  const spaceSettingsLink = document.getElementById('spaceSettingsLink');
  const timelineCallActions = document.getElementById('timelineCallActions');
  const voiceCallBtn = document.getElementById('voiceCallBtn');
  const videoCallBtn = document.getElementById('videoCallBtn');
  const hangupCallBtn = document.getElementById('hangupCallBtn');
  const roomSearchBtn = document.getElementById('roomSearchBtn');
  const messageSearchView = document.getElementById('messageSearchView');
  const messageSearchBack = document.getElementById('messageSearchBack');
  const messageSearchForm = document.getElementById('messageSearchForm');
  const messageSearchInput = document.getElementById('messageSearchInput');
  const messageSearchEnter = document.getElementById('messageSearchEnter');
  const messageSearchFilterDms = document.getElementById('messageSearchFilterDms');
  const messageSearchFilterGlobal = document.getElementById('messageSearchFilterGlobal');
  const messageSearchRoomChip = document.getElementById('messageSearchRoomChip');
  const messageSearchRoomChipLabel = document.getElementById('messageSearchRoomChipLabel');
  const messageSearchSort = document.getElementById('messageSearchSort');
  const messageSearchResults = document.getElementById('messageSearchResults');
  const roomPinsBtn = document.getElementById('roomPinsBtn');
  const roomPinsBadge = document.getElementById('roomPinsBadge');
  const roomPinsPanel = document.getElementById('roomPinsPanel');
  const roomPinsClose = document.getElementById('roomPinsClose');
  const roomPinsList = document.getElementById('roomPinsList');
  const roomThreadsBtn = document.getElementById('roomThreadsBtn');
  const roomThreadsPanel = document.getElementById('roomThreadsPanel');
  const roomThreadsClose = document.getElementById('roomThreadsClose');
  const roomThreadsList = document.getElementById('roomThreadsList');
  const roomMediaBtn = document.getElementById('roomMediaBtn');
  const sharedMediaPanel = document.getElementById('sharedMediaPanel');
  const sharedMediaClose = document.getElementById('sharedMediaClose');
  const sharedMediaFilters = document.getElementById('sharedMediaFilters');
  const sharedMediaBody = document.getElementById('sharedMediaBody');
  const roomMoreBtn = document.getElementById('roomMoreBtn');
  const roomMembersBtn = document.getElementById('roomMembersBtn');
  const chatStage = document.getElementById('chatStage');
  const roomMembersPanel = document.getElementById('roomMembersPanel');
  const roomMembersTitle = document.getElementById('roomMembersTitle');
  const roomMembersClose = document.getElementById('roomMembersClose');
  const roomMembersFilter = document.getElementById('roomMembersFilter');
  const roomMembersList = document.getElementById('roomMembersList');
  const callStatus = document.getElementById('callStatus');
  const callMediaDock = document.getElementById('callMediaDock');
  const callPanelTitle = document.getElementById('callPanelTitle');
  const callPanelTimer = document.getElementById('callPanelTimer');
  const callParticipantsSection = document.getElementById('callParticipantsSection');
  const callParticipantsToggle = document.getElementById('callParticipantsToggle');
  const callParticipantList = document.getElementById('callParticipantList');
  const callParticipantLabel = document.getElementById('callParticipantLabel');
  const callScreenFrame = document.getElementById('callScreenFrame');
  const callMuteBtn = document.getElementById('callMuteBtn');
  const callDeafenBtn = document.getElementById('callDeafenBtn');
  const callVideoToggleBtn = document.getElementById('callVideoToggleBtn');
  const callScreenBtn = document.getElementById('callScreenBtn');
  const callDockHangupBtn = document.getElementById('callDockHangupBtn');
  const screenCallVideo = document.getElementById('screenCallVideo');
  const remoteCallVideo = document.getElementById('remoteCallVideo');
  const localCallVideo = document.getElementById('localCallVideo');
  const remoteCallAudio = document.getElementById('remoteCallAudio');
  const incomingCallBanner = document.getElementById('incomingCallBanner');
  const incomingCallTitle = document.getElementById('incomingCallTitle');
  const incomingCallMeta = document.getElementById('incomingCallMeta');
  const incomingCallAccept = document.getElementById('incomingCallAccept');
  const incomingCallReject = document.getElementById('incomingCallReject');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const invitesBtn = document.getElementById('invitesBtn');
  const invitesBadge = document.getElementById('invitesBadge');
  const invitesPanel = document.getElementById('invitesPanel');
  const invitesPanelClose = document.getElementById('invitesPanelClose');
  const invitesList = document.getElementById('invitesList');
  const railHeadDefaultActions = document.getElementById('railHeadDefaultActions');
  const railHeadDmActions = document.getElementById('railHeadDmActions');
  const dmCreateChatHeadBtn = document.getElementById('dmCreateChatHeadBtn');
  const dmRailNav = document.getElementById('dmRailNav');
  const spaceRailNav = document.getElementById('spaceRailNav');
  const spaceLobbyBtn = document.getElementById('spaceLobbyBtn');
  const spaceLobbyBtnLabel = document.getElementById('spaceLobbyBtnLabel');
  const spaceMessageSearchBtn = document.getElementById('spaceMessageSearchBtn');
  const dmCreateChatBtn = document.getElementById('dmCreateChatBtn');
  const dmMessageSearchBtn = document.getElementById('dmMessageSearchBtn');
  const dmInvitesBtn = document.getElementById('dmInvitesBtn');
  const dmInvitesBadge = document.getElementById('dmInvitesBadge');
  const createChatPane = document.getElementById('createChatPane');
  const lobbyPane = document.getElementById('lobbyPane');
  const lobbyBody = document.getElementById('lobbyBody');
  const forumPane = document.getElementById('forumPane');
  const forumBody = document.getElementById('forumBody');
  const forumPostDialog = document.getElementById('forumPostDialog');
  const forumPostForm = document.getElementById('forumPostForm');
  const forumPostTopic = document.getElementById('forumPostTopic');
  const forumPostTitle = document.getElementById('forumPostTitle');
  const forumPostBody = document.getElementById('forumPostBody');
  const forumPostError = document.getElementById('forumPostError');
  const forumPostCancel = document.getElementById('forumPostCancel');
  const forumPostSubmit = document.getElementById('forumPostSubmit');
  const createChildDialog = document.getElementById('createChildDialog');
  const createChildForm = document.getElementById('createChildForm');
  const createChildTitle = document.getElementById('createChildTitle');
  const createChildLede = document.getElementById('createChildLede');
  const createChildParentId = document.getElementById('createChildParentId');
  const createChildKind = document.getElementById('createChildKind');
  const createChildName = document.getElementById('createChildName');
  const createChildNamePrefix = document.getElementById('createChildNamePrefix');
  const createChildTopic = document.getElementById('createChildTopic');
  const createChildAlias = document.getElementById('createChildAlias');
  const createChildAliasBlock = document.getElementById('createChildAliasBlock');
  const createChildAccessBlock = document.getElementById('createChildAccessBlock');
  const createChildOptionsBlock = document.getElementById('createChildOptionsBlock');
  const createChildEncryption = document.getElementById('createChildEncryption');
  const createChildEncryptionRow = document.getElementById('createChildEncryptionRow');
  const createChildForum = document.getElementById('createChildForum');
  const createChildKnock = document.getElementById('createChildKnock');
  const createChildKnockRow = document.getElementById('createChildKnockRow');
  const createChildFederation = document.getElementById('createChildFederation');
  const createChildAdvanceToggle = document.getElementById('createChildAdvanceToggle');
  const createChildAdvanceOptions = document.getElementById('createChildAdvanceOptions');
  const createChildError = document.getElementById('createChildError');
  const createChildCancel = document.getElementById('createChildCancel');
  const createChildSubmit = document.getElementById('createChildSubmit');
  const createChatForm = document.getElementById('createChatForm');
  const createChatUserId = document.getElementById('createChatUserId');
  const createChatEncrypted = document.getElementById('createChatEncrypted');
  const createChatError = document.getElementById('createChatError');
  const createChatSubmit = document.getElementById('createChatSubmit');
  const inviteUserDialog = document.getElementById('inviteUserDialog');
  const inviteUserForm = document.getElementById('inviteUserForm');
  const inviteUserTitle = document.getElementById('inviteUserTitle');
  const inviteUserMeta = document.getElementById('inviteUserMeta');
  const inviteUserInput = document.getElementById('inviteUserInput');
  const inviteUserError = document.getElementById('inviteUserError');
  const inviteUserCancel = document.getElementById('inviteUserCancel');
  const joinRoomDialog = document.getElementById('joinRoomDialog');
  const joinRoomForm = document.getElementById('joinRoomForm');
  const joinRoomInput = document.getElementById('joinRoomInput');
  const joinRoomError = document.getElementById('joinRoomError');
  const joinRoomCancel = document.getElementById('joinRoomCancel');
  const notificationsEnabled = document.getElementById('notificationsEnabled');
  const notificationsInvites = document.getElementById('notificationsInvites');
  const notificationsSounds = document.getElementById('notificationsSounds');
  const notificationsTestBtn = document.getElementById('notificationsTestBtn');
  const notificationsStatus = document.getElementById('notificationsStatus');
  const notificationsEmailStatus = document.getElementById('notificationsEmailStatus');
  const notifUnderrideList = document.getElementById('notifUnderrideList');
  const notifSpecialList = document.getElementById('notifSpecialList');
  const notifKeywordList = document.getElementById('notifKeywordList');
  const notifKeywordInput = document.getElementById('notifKeywordInput');
  const notifKeywordSaveBtn = document.getElementById('notifKeywordSaveBtn');
  const notifRulesStatus = document.getElementById('notifRulesStatus');
  const audioInputSelect = document.getElementById('audioInputSelect');
  const audioOutputSelect = document.getElementById('audioOutputSelect');
  const audioInputTestBtn = document.getElementById('audioInputTestBtn');
  const audioInputMonitorBtn = document.getElementById('audioInputMonitorBtn');
  const audioOutputTestBtn = document.getElementById('audioOutputTestBtn');
  const audioInputStatus = document.getElementById('audioInputStatus');
  const audioOutputStatus = document.getElementById('audioOutputStatus');
  const prefNoiseSuppression = document.getElementById('prefNoiseSuppression');
  const prefEchoCancellation = document.getElementById('prefEchoCancellation');
  const prefAutoGainControl = document.getElementById('prefAutoGainControl');
  const prefScreenResolution = document.getElementById('prefScreenResolution');
  const prefScreenBitrate = document.getElementById('prefScreenBitrate');
  const prefScreenFps = document.getElementById('prefScreenFps');
  const prefShowRemoteCursor = document.getElementById('prefShowRemoteCursor');
  const twitterEmojiEnabled = document.getElementById('twitterEmojiEnabled');
  const prefEnterForNewline = document.getElementById('prefEnterForNewline');
  const prefMarkdownFormatting = document.getElementById('prefMarkdownFormatting');
  const prefSpellcheck = document.getElementById('prefSpellcheck');
  const composerAutocomplete = document.getElementById('composerAutocomplete');
  const forwardMessageDialog = document.getElementById('forwardMessageDialog');
  const forwardMessageForm = document.getElementById('forwardMessageForm');
  const forwardMessageSearch = document.getElementById('forwardMessageSearch');
  const forwardMessageList = document.getElementById('forwardMessageList');
  const forwardMessageError = document.getElementById('forwardMessageError');
  const forwardMessageCancel = document.getElementById('forwardMessageCancel');
  const reactionDetailsDialog = document.getElementById('reactionDetailsDialog');
  const reactionDetailsTitle = document.getElementById('reactionDetailsTitle');
  const reactionDetailsList = document.getElementById('reactionDetailsList');
  const sasVerifyDialog = document.getElementById('sasVerifyDialog');
  const sasVerifyEmojis = document.getElementById('sasVerifyEmojis');
  const sasVerifyError = document.getElementById('sasVerifyError');
  const sasVerifyMatch = document.getElementById('sasVerifyMatch');
  const sasVerifyMismatch = document.getElementById('sasVerifyMismatch');
  const sasVerifyCancel = document.getElementById('sasVerifyCancel');
  const roomSettingsName = document.getElementById('roomSettingsName');
  const roomSettingsTopic = document.getElementById('roomSettingsTopic');
  const roomSettingsJoinRule = document.getElementById('roomSettingsJoinRule');
  const roomSettingsError = document.getElementById('roomSettingsError');
  const roomSettingsCancel = document.getElementById('roomSettingsCancel');
  const roomSettingsSave = document.getElementById('roomSettingsSave');
  const prefHideActivity = document.getElementById('prefHideActivity');
  const prefHour24 = document.getElementById('prefHour24');
  const prefDateFormat = document.getElementById('prefDateFormat');
  const prefAutoJoinSpaceRooms = document.getElementById('prefAutoJoinSpaceRooms');
  const prefMessageLayout = document.getElementById('prefMessageLayout');
  const prefMessageSpacing = document.getElementById('prefMessageSpacing');
  const prefScrollOnReselect = document.getElementById('prefScrollOnReselect');
  const prefLegacyUsernameColor = document.getElementById('prefLegacyUsernameColor');
  const prefHideMembership = document.getElementById('prefHideMembership');
  const prefHideProfileChange = document.getElementById('prefHideProfileChange');
  const prefDisableMediaAutoLoad = document.getElementById('prefDisableMediaAutoLoad');
  const prefUrlPreview = document.getElementById('prefUrlPreview');
  const prefUrlPreviewEncrypted = document.getElementById('prefUrlPreviewEncrypted');
  const prefShowHiddenEvents = document.getElementById('prefShowHiddenEvents');
  const prefSystemTheme = document.getElementById('prefSystemTheme');
  const prefMonochrome = document.getElementById('prefMonochrome');
  const prefPageZoom = document.getElementById('prefPageZoom');
  const prefLanguage = document.getElementById('prefLanguage');
  const prefTextSize = document.getElementById('prefTextSize');
  const devicesCurrentList = document.getElementById('devicesCurrentList');
  const devicesOthersList = document.getElementById('devicesOthersList');
  const devicesStatus = document.getElementById('devicesStatus');
  const deviceVerificationBtn = document.getElementById('deviceVerificationBtn');
  const deviceVerificationMenuBtn = document.getElementById('deviceVerificationMenuBtn');
  const deviceVerificationMenu = document.getElementById('deviceVerificationMenu');
  const deviceVerificationResetBtn = document.getElementById('deviceVerificationResetBtn');
  const deviceSecurityNote = document.getElementById('deviceSecurityNote');
  const deviceBackupRow = document.getElementById('deviceBackupRow');
  const deviceBackupLabel = document.getElementById('deviceBackupLabel');
  const deviceBackupSetupBtn = document.getElementById('deviceBackupSetupBtn');
  const cryptoSetupDialog = document.getElementById('cryptoSetupDialog');
  const cryptoSetupForm = document.getElementById('cryptoSetupForm');
  const cryptoSetupTitle = document.getElementById('cryptoSetupTitle');
  const cryptoSetupRecoveryKey = document.getElementById('cryptoSetupRecoveryKey');
  const cryptoSetupError = document.getElementById('cryptoSetupError');
  const cryptoSetupCancel = document.getElementById('cryptoSetupCancel');
  const cryptoSetupSubmit = document.getElementById('cryptoSetupSubmit');
  const accountPasswordDialog = document.getElementById('accountPasswordDialog');
  const accountPasswordForm = document.getElementById('accountPasswordForm');
  const accountPasswordTitle = document.getElementById('accountPasswordTitle');
  const accountPasswordTopic = document.getElementById('accountPasswordTopic');
  const accountPasswordInput = document.getElementById('accountPasswordInput');
  const accountPasswordError = document.getElementById('accountPasswordError');
  const accountPasswordCancel = document.getElementById('accountPasswordCancel');
  const accountPasswordSubmit = document.getElementById('accountPasswordSubmit');
  const removeUnverifiedDevicesBtn = document.getElementById('removeUnverifiedDevicesBtn');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const aboutSourceCodeBtn = document.getElementById('aboutSourceCodeBtn');
  const protocolHandlerStatus = document.getElementById('protocolHandlerStatus');
  const protocolRepairBtn = document.getElementById('protocolRepairBtn');
  const mobileCompanionUrls = document.getElementById('mobileCompanionUrls');
  const mobileCompanionRefreshBtn = document.getElementById('mobileCompanionRefreshBtn');
  const protocolRefreshBtn = document.getElementById('protocolRefreshBtn');
  const prefAutoConvertEmoticons = document.getElementById('prefAutoConvertEmoticons');
  const defaultPackName = document.getElementById('defaultPackName');
  const defaultPackViewBtn = document.getElementById('defaultPackViewBtn');
  const favoritePackSelectBtn = document.getElementById('favoritePackSelectBtn');
  const favoritePackList = document.getElementById('favoritePackList');
  const telegramBotTokenInput = document.getElementById('telegramBotTokenInput');
  const telegramPackUrlInput = document.getElementById('telegramPackUrlInput');
  const telegramImportBtn = document.getElementById('telegramImportBtn');
  const telegramImportStatus = document.getElementById('telegramImportStatus');
  const stickerPackViewDialog = document.getElementById('stickerPackViewDialog');
  const stickerPackViewTitle = document.getElementById('stickerPackViewTitle');
  const stickerPackViewGrid = document.getElementById('stickerPackViewGrid');
  const stickerPackViewClose = document.getElementById('stickerPackViewClose');
  const stickerPackSetDefaultBtn = document.getElementById('stickerPackSetDefaultBtn');
  const favoritePackDialog = document.getElementById('favoritePackDialog');
  const favoritePackForm = document.getElementById('favoritePackForm');
  const favoritePackOptions = document.getElementById('favoritePackOptions');
  const favoritePackCancel = document.getElementById('favoritePackCancel');
  const favoritePackError = document.getElementById('favoritePackError');
  const prefDeveloperTools = document.getElementById('prefDeveloperTools');
  const devtoolsOptionsExtra = document.getElementById('devtoolsOptionsExtra');
  const devtoolsCopyTokenBtn = document.getElementById('devtoolsCopyTokenBtn');
  const devtoolsAccountDataSection = document.getElementById('devtoolsAccountDataSection');
  const devtoolsAccountDataToggle = document.getElementById('devtoolsAccountDataToggle');
  const devtoolsAccountDataBody = document.getElementById('devtoolsAccountDataBody');
  const devtoolsAccountDataTotal = document.getElementById('devtoolsAccountDataTotal');
  const devtoolsAccountDataAddBtn = document.getElementById('devtoolsAccountDataAddBtn');
  const devtoolsAccountDataList = document.getElementById('devtoolsAccountDataList');
  const accountDataDialog = document.getElementById('accountDataDialog');
  const accountDataForm = document.getElementById('accountDataForm');
  const accountDataDialogTitle = document.getElementById('accountDataDialogTitle');
  const accountDataDialogTopic = document.getElementById('accountDataDialogTopic');
  const accountDataTypeLabel = document.getElementById('accountDataTypeLabel');
  const accountDataTypeInput = document.getElementById('accountDataTypeInput');
  const accountDataContentInput = document.getElementById('accountDataContentInput');
  const accountDataError = document.getElementById('accountDataError');
  const accountDataCancel = document.getElementById('accountDataCancel');
  const accountDataSave = document.getElementById('accountDataSave');

  /** @type {{ packs: any[], defaultPackId: string, favoritePackIds: string[], telegramBotToken?: string } | null} */
  let stickerPackState = null;
  let viewingPackId = null;
  let accountDataExpanded = false;
  let accountDataEditMode = 'view'; // 'view' | 'create'
  const homeserverInput = document.getElementById('homeserver');
  const userInput = document.getElementById('user');

  let activeRoomId = null;
  let sessionUserId = null;
  let lastSessionState = null;
  let didRestoreLastRoom = false;
  let voipPeerLabel = 'Peer';
  let callStartedAt = null;
  let callTimerInterval = null;
  let callParticipantsOpen = true;
  let callMemberCache = [];
  /** @type {Set<string>} */
  let speakingUserIds = new Set();
  let callRingingSoundActive = false;
  let inviteTarget = null; // { kind: 'room'|'space', id, name }
  let inviteCatalog = [];
  let activityCursor = 0;
  let activityReady = false;
  let notifClickUnsub = null;
  let activeSpaceFilter = (() => {
    const stored = localStorage.getItem('relay.space') || 'dms';
    return stored === 'home' ? 'dms' : stored;
  })();
  let spaceCatalog = [];
  let roomCatalog = [];
  /** @type {Map<string, string>} */
  const spaceNameCache = new Map();
  let roomSidebarGroups = [];
  let closedRoomFolders = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem('relay.closedFolders') || '[]');
      return new Set(Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : []);
    } catch {
      return new Set();
    }
  })();

  function persistClosedRoomFolders() {
    writeJsonArray('relay.closedFolders', [...closedRoomFolders]);
  }

  function isRoomFolderClosed(folderId) {
    return closedRoomFolders.has(String(folderId || ''));
  }

  function setRoomFolderClosed(folderId, closed) {
    const id = String(folderId || '');
    if (!id) return;
    if (closed) closedRoomFolders.add(id);
    else closedRoomFolders.delete(id);
    persistClosedRoomFolders();
  }
  let roomMembersCache = [];
  let membersPanelOpen = localStorage.getItem('relay.membersDrawer') === '1';
  let roomsDrawerOpen = false;
  let mobileDrawerMq = null;
  try {
    mobileDrawerMq = window.matchMedia('(max-width: 720px)');
  } catch {
    mobileDrawerMq = null;
  }
  let sharedMediaOpen = false;
  let sharedMediaItems = [];
  let sharedMediaSenderFilter = new Set();
  let sharedMediaRoomId = null;
  let messageSearchOpen = false;
  let messageSearchScope = 'room';
  let messageSearchRoomId = null;
  let createChatOpen = false;
  let lobbyOpen = false;
  let forumOpen = false;
  let lobbySpaceSummary = null;
  let forumBoard = null;
  let forumTopicFilter = '';
  /** @type {{ roomId: string, eventId: string, data: object|null }|null} */
  let forumThread = null;
  let forumReplyToEventId = null;
  let pendingScrollEventId = null;
  let pendingMentions = [];
  /** @type {{ eventId: string, sender: string|null, senderName: string|null, body: string|null, thread?: boolean }|null} */
  let pendingReply = null;
  /** @type {{ eventId: string, body: string|null }|null} */
  let pendingEdit = null;
  /** @type {{ roomId: string, eventId: string }|null} */
  let pendingReactionTarget = null;
  let pendingAttachments = [];
  const DEFAULT_QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
  const QUICK_REACTIONS = DEFAULT_QUICK_REACTIONS;
  let attachmentsUploading = false;
  let profileUser = null;
  let contextSpaceId = null;
  let contextFolderId = null;
  let contextRoomId = null;
  /** @type {{ roomId: string, eventId: string, body: string|null, canRedact: boolean, sender: string|null }|null} */
  let contextMessage = null;
  let dragSpaceId = null;
  let dragFolderId = null;
  /** @type {{ mode: 'before'|'after'|'folder'|null, spaceId: string|null, folderId: string|null }} */
  let railDropHint = { mode: null, spaceId: null, folderId: null };
  let pollTimer = null;
  let typingPollTimer = null;
  let typingIdleTimer = null;
  let localTypingSent = false;
  let lastTypingSentAt = 0;
  let lastTypingFingerprint = '';

  function readJsonArray(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  function writeJsonArray(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getMutedRooms() {
    return new Set(readJsonArray('relay.mutedRooms'));
  }

  function setMutedRooms(ids) {
    writeJsonArray('relay.mutedRooms', [...ids]);
  }

  function readNotifPref(key, fallback = true) {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === '1' || raw === 'true';
  }

  function writeNotifPref(key, value) {
    localStorage.setItem(key, value ? '1' : '0');
  }

  function loadNotificationSettings() {
    if (notificationsEnabled) notificationsEnabled.checked = readNotifPref('relay.notifications', true);
    if (notificationsInvites) notificationsInvites.checked = readNotifPref('relay.notifications.invites', true);
    if (notificationsSounds) notificationsSounds.checked = readNotifPref('relay.notifications.sounds', true);
    updateNotificationsStatus();
    void refreshPushNotificationSettings();
  }

  const NOTIF_MODE_OPTIONS = [
    { value: 'off', label: 'Off' },
    { value: 'notify', label: 'Notify Silent' },
    { value: 'loud', label: 'Notify Loud' },
  ];

  function fillNotifModeSelect(select, mode) {
    select.replaceChildren();
    for (const option of NOTIF_MODE_OPTIONS) {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      select.appendChild(opt);
    }
    select.value = ['off', 'notify', 'loud'].includes(mode) ? mode : 'notify';
  }

  function renderNotifRuleRows(container, rules, { removable = false } = {}) {
    if (!container) return;
    container.replaceChildren();
    if (!rules?.length) {
      if (removable) {
        const empty = document.createElement('p');
        empty.className = 'settings-muted';
        empty.textContent = 'No keywords yet.';
        container.appendChild(empty);
      }
      return;
    }
    for (const rule of rules) {
      const row = document.createElement('div');
      row.className = 'notif-rule-row';
      const label = document.createElement('span');
      label.textContent = rule.label || rule.pattern || rule.ruleId;
      const select = document.createElement('select');
      select.setAttribute('aria-label', label.textContent);
      fillNotifModeSelect(select, rule.mode);
      select.addEventListener('change', async () => {
        try {
          if (notifRulesStatus) notifRulesStatus.textContent = 'Saving…';
          const data = await api('/api/notifications/rules', {
            method: 'PUT',
            body: JSON.stringify({
              kind: rule.kind,
              ruleId: rule.ruleId,
              mode: select.value,
            }),
          });
          applyPushNotificationSettings(data);
          if (notifRulesStatus) notifRulesStatus.textContent = '';
        } catch (error) {
          if (notifRulesStatus) notifRulesStatus.textContent = error.message || String(error);
          select.value = rule.mode;
        }
      });
      row.append(label, select);
      if (removable) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'ghost danger-text';
        remove.textContent = 'Remove';
        remove.addEventListener('click', async () => {
          try {
            const data = await api(
              `/api/notifications/keywords/${encodeURIComponent(rule.ruleId)}`,
              { method: 'DELETE' },
            );
            applyPushNotificationSettings(data);
          } catch (error) {
            if (notifRulesStatus) notifRulesStatus.textContent = error.message || String(error);
          }
        });
        row.append(remove);
      }
      container.appendChild(row);
    }
  }

  function applyPushNotificationSettings(data) {
    if (!data) return;
    if (notificationsEmailStatus) {
      if (data.email || (Array.isArray(data.emails) && data.emails.length)) {
        const emails = Array.isArray(data.emails) && data.emails.length ? data.emails : [data.email];
        notificationsEmailStatus.className = 'settings-muted';
        notificationsEmailStatus.textContent = `Email attached: ${emails.filter(Boolean).join(', ')}`;
      } else {
        notificationsEmailStatus.className = 'settings-danger';
        notificationsEmailStatus.textContent = 'Your account does not have any email attached.';
      }
    }
    renderNotifRuleRows(notifUnderrideList, data.underride || []);
    renderNotifRuleRows(notifSpecialList, data.special || []);
    renderNotifRuleRows(notifKeywordList, data.keywords || [], { removable: true });
  }

  async function refreshPushNotificationSettings() {
    if (notifRulesStatus) notifRulesStatus.textContent = 'Loading notification rules…';
    try {
      const data = await api('/api/notifications/rules');
      applyPushNotificationSettings(data);
      if (notifRulesStatus) notifRulesStatus.textContent = '';
    } catch (error) {
      if (notifRulesStatus) notifRulesStatus.textContent = error.message || String(error);
      if (notificationsEmailStatus) {
        notificationsEmailStatus.className = 'settings-muted';
        notificationsEmailStatus.textContent = 'Sign in to manage Matrix notification rules.';
      }
    }
  }

  let micMonitorStream = null;
  let micMonitorAudio = null;

  function stopMicMonitor() {
    if (micMonitorStream) {
      for (const track of micMonitorStream.getTracks()) track.stop();
      micMonitorStream = null;
    }
    if (micMonitorAudio) {
      try {
        micMonitorAudio.pause();
        micMonitorAudio.srcObject = null;
      } catch {
        // ignore
      }
      micMonitorAudio = null;
    }
    if (audioInputMonitorBtn) {
      audioInputMonitorBtn.textContent = 'Monitor';
      audioInputMonitorBtn.classList.remove('is-active');
    }
  }

  function fillDeviceSelect(select, devices, selectedId, kindLabel) {
    if (!select) return;
    select.replaceChildren();
    const def = document.createElement('option');
    def.value = '';
    def.textContent = `Default — system ${kindLabel}`;
    select.appendChild(def);
    for (const device of devices) {
      const opt = document.createElement('option');
      opt.value = device.deviceId;
      opt.textContent = device.label || `${kindLabel} (${device.deviceId.slice(0, 8)})`;
      select.appendChild(opt);
    }
    select.value = selectedId && [...select.options].some((o) => o.value === selectedId)
      ? selectedId
      : '';
  }

  async function ensureMediaPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      return true;
    } catch (error) {
      if (audioInputStatus) audioInputStatus.textContent = error.message || String(error);
      return false;
    }
  }

  async function loadAudioVideoSettings() {
    const prefs = window.RelayMediaPrefs?.get?.() || {};
    if (prefNoiseSuppression) prefNoiseSuppression.checked = Boolean(prefs.noiseSuppression);
    if (prefEchoCancellation) prefEchoCancellation.checked = Boolean(prefs.echoCancellation);
    if (prefAutoGainControl) prefAutoGainControl.checked = prefs.autoGainControl !== false;
    if (prefScreenResolution) prefScreenResolution.value = prefs.screenResolution || 'source';
    if (prefScreenBitrate) prefScreenBitrate.value = prefs.screenBitrate || 'ultra';
    if (prefScreenFps) prefScreenFps.value = String(prefs.screenFps || 15);
    if (prefShowRemoteCursor) prefShowRemoteCursor.checked = prefs.showRemoteCursor !== false;

    if (!navigator.mediaDevices?.enumerateDevices) {
      if (audioInputStatus) audioInputStatus.textContent = 'Media devices API unavailable.';
      return;
    }
    await ensureMediaPermission();
    const devices = await navigator.mediaDevices.enumerateDevices();
    fillDeviceSelect(
      audioInputSelect,
      devices.filter((d) => d.kind === 'audioinput'),
      prefs.audioInput || '',
      'microphone',
    );
    fillDeviceSelect(
      audioOutputSelect,
      devices.filter((d) => d.kind === 'audiooutput'),
      prefs.audioOutput || '',
      'speaker',
    );
    if (audioInputStatus) audioInputStatus.textContent = '';
    if (audioOutputStatus) {
      audioOutputStatus.textContent =
        typeof HTMLMediaElement !== 'undefined' &&
        HTMLMediaElement.prototype &&
        typeof HTMLMediaElement.prototype.setSinkId === 'function'
          ? ''
          : 'Output device switching is limited on this platform.';
    }
    void window.RelayMediaPrefs?.applyAudioOutput?.(remoteCallAudio);
  }

  async function playMicTestTone() {
    if (audioInputStatus) audioInputStatus.textContent = 'Listening…';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: window.RelayMediaPrefs?.audioConstraints?.() || true,
      });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let peaks = 0;
      const started = Date.now();
      await new Promise((resolve) => {
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          if (avg > 18) peaks += 1;
          if (Date.now() - started < 1200) requestAnimationFrame(tick);
          else resolve();
        };
        tick();
      });
      for (const track of stream.getTracks()) track.stop();
      void ctx.close();
      if (audioInputStatus) {
        audioInputStatus.textContent = peaks > 4 ? 'Microphone is picking up audio.' : 'Little or no input detected — try speaking.';
      }
    } catch (error) {
      if (audioInputStatus) audioInputStatus.textContent = error.message || String(error);
    }
  }

  async function toggleMicMonitor() {
    if (micMonitorStream) {
      stopMicMonitor();
      if (audioInputStatus) audioInputStatus.textContent = 'Monitor stopped.';
      return;
    }
    try {
      micMonitorStream = await navigator.mediaDevices.getUserMedia({
        audio: window.RelayMediaPrefs?.audioConstraints?.() || true,
      });
      micMonitorAudio = new Audio();
      micMonitorAudio.srcObject = micMonitorStream;
      await window.RelayMediaPrefs?.applyAudioOutput?.(micMonitorAudio);
      await micMonitorAudio.play();
      if (audioInputMonitorBtn) {
        audioInputMonitorBtn.textContent = 'Stop';
        audioInputMonitorBtn.classList.add('is-active');
      }
      if (audioInputStatus) audioInputStatus.textContent = 'Monitoring microphone (you should hear yourself).';
    } catch (error) {
      stopMicMonitor();
      if (audioInputStatus) audioInputStatus.textContent = error.message || String(error);
    }
  }

  function playSpeakerTestTone() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.stop(ctx.currentTime + 0.4);
      window.setTimeout(() => void ctx.close(), 500);
      if (audioOutputStatus) audioOutputStatus.textContent = 'Played test tone.';
      void window.RelayMediaPrefs?.applyAudioOutput?.(remoteCallAudio);
    } catch (error) {
      if (audioOutputStatus) audioOutputStatus.textContent = error.message || String(error);
    }
  }

  const soundPlayers = {
    notification: null,
    invite: null,
    call: null,
  };

  function playRelaySound(kind) {
    if (!readNotifPref('relay.notifications.sounds', true)) return;
    const src =
      kind === 'invite'
        ? '/sound/invite.ogg'
        : kind === 'call'
          ? '/sound/call.ogg'
          : '/sound/notification.ogg';
    try {
      if (!soundPlayers[kind]) {
        soundPlayers[kind] = new Audio(src);
      }
      const audio = soundPlayers[kind];
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    } catch {
      // ignore autoplay / decode errors
    }
  }

  function stopRelaySound(kind) {
    const audio = soundPlayers[kind];
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // ignore
    }
  }

  function applyTwitterEmojiSetting(enabled) {
    document.documentElement.classList.toggle('twitter-emoji', Boolean(enabled));
    writeNotifPref('relay.twitterEmoji', Boolean(enabled));
    if (twitterEmojiEnabled) twitterEmojiEnabled.checked = Boolean(enabled);
  }

  function loadTwitterEmojiSetting() {
    const enabled = readNotifPref('relay.twitterEmoji', true);
    applyTwitterEmojiSetting(enabled);
  }

  function readBoolPref(key, fallback = false) {
    return readNotifPref(key, fallback);
  }

  function writeBoolPref(key, value) {
    writeNotifPref(key, Boolean(value));
  }

  function readStringPref(key, fallback = '') {
    const raw = localStorage.getItem(key);
    return raw == null || raw === '' ? fallback : raw;
  }

  function writeStringPref(key, value) {
    localStorage.setItem(key, String(value));
  }

  function hideActivityEnabled() {
    return readBoolPref('relay.hideActivity', false);
  }

  function markdownFormattingEnabled() {
    return readBoolPref('relay.markdownFormatting', true);
  }

  function autoConvertEmoticonsEnabled() {
    return readBoolPref('relay.autoConvertEmoticons', true);
  }

  function developerToolsEnabled() {
    return readBoolPref('relay.developerTools', false);
  }

  function applyDeveloperToolsVisibility() {
    const enabled = developerToolsEnabled();
    if (prefDeveloperTools) prefDeveloperTools.checked = enabled;
    if (devtoolsOptionsExtra) devtoolsOptionsExtra.hidden = !enabled;
    if (devtoolsAccountDataSection) devtoolsAccountDataSection.hidden = !enabled;
    if (!enabled) {
      accountDataExpanded = false;
      if (devtoolsAccountDataBody) devtoolsAccountDataBody.hidden = true;
      if (devtoolsAccountDataToggle) devtoolsAccountDataToggle.textContent = 'Expand';
    }
  }

  function setAccountDataError(message) {
    if (!accountDataError) return;
    const text = String(message || '').trim();
    accountDataError.hidden = !text;
    accountDataError.textContent = text;
  }

  async function refreshAccountDataList() {
    if (!devtoolsAccountDataList) return;
    try {
      const data = await api('/api/devtools/account-data');
      const events = Array.isArray(data.events) ? data.events : [];
      if (devtoolsAccountDataTotal) {
        devtoolsAccountDataTotal.textContent = `Total: ${data.total ?? events.length}`;
      }
      devtoolsAccountDataList.replaceChildren();
      for (const entry of events) {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = `<span></span><span class="devtools-event-chevron" aria-hidden="true">›</span>`;
        btn.querySelector('span').textContent = entry.type;
        btn.addEventListener('click', () => {
          void openAccountDataEditor(entry.type);
        });
        li.append(btn);
        devtoolsAccountDataList.append(li);
      }
    } catch (error) {
      if (devtoolsAccountDataTotal) {
        devtoolsAccountDataTotal.textContent = error.message || String(error);
      }
    }
  }

  function loadDeveloperToolsSettings() {
    applyDeveloperToolsVisibility();
    if (developerToolsEnabled() && accountDataExpanded) {
      void refreshAccountDataList();
    }
  }

  async function refreshMobileCompanionStatus() {
    if (!mobileCompanionUrls) return;
    try {
      const health = await api('/api/health');
      const urls = Array.isArray(health.lanAddresses) ? health.lanAddresses.filter(Boolean) : [];
      if (!urls.length) {
        mobileCompanionUrls.textContent =
          'No LAN address found yet. Check Wi‑Fi, then Refresh. Default port is 6080.';
        return;
      }
      mobileCompanionUrls.textContent = urls.join('\n');
      mobileCompanionUrls.style.whiteSpace = 'pre-wrap';
    } catch (error) {
      mobileCompanionUrls.textContent = error.message || String(error);
    }
  }

  async function refreshAboutSettings() {
    try {
      const health = await api('/api/health');
      if (settingsVersion) settingsVersion.textContent = `v${health.version || '0.1.0'}`;
    } catch {
      if (settingsVersion) settingsVersion.textContent = 'v0.1.0';
    }
    if (window.relayDesktop?.getAppInfo) {
      try {
        const info = await window.relayDesktop.getAppInfo();
        if (settingsVersion && info?.version) {
          settingsVersion.textContent = `v${info.version}`;
        }
      } catch {
        // keep health version
      }
    }
    await refreshProtocolHandlerStatus();
    await refreshMobileCompanionStatus();
  }

  async function refreshProtocolHandlerStatus() {
    if (!protocolHandlerStatus) return;
    if (!window.relayDesktop?.getProtocolStatus) {
      protocolHandlerStatus.textContent =
        'Protocol handler is only available in the Kitsu desktop app.';
      if (protocolRepairBtn) protocolRepairBtn.disabled = true;
      return;
    }
    try {
      const status = await window.relayDesktop.getProtocolStatus();
      protocolHandlerStatus.textContent =
        status?.message ||
        (status?.registered
          ? `kitsu is registered on ${status.platform || 'this platform'}.`
          : 'kitsu is not registered.');
      if (protocolRepairBtn) protocolRepairBtn.disabled = false;
    } catch (error) {
      protocolHandlerStatus.textContent = error.message || String(error);
    }
  }

  async function openAccountDataEditor(eventType = null) {
    if (!accountDataDialog || !accountDataForm) return;
    accountDataEditMode = eventType ? 'view' : 'create';
    setAccountDataError('');
    if (accountDataDialogTitle) {
      accountDataDialogTitle.textContent = eventType ? eventType : 'Add account data';
    }
    if (accountDataDialogTopic) {
      accountDataDialogTopic.textContent = eventType
        ? 'View or edit this account data event.'
        : 'Create a new global account data event.';
    }
    if (accountDataTypeLabel) accountDataTypeLabel.hidden = Boolean(eventType);
    if (accountDataTypeInput) {
      accountDataTypeInput.value = eventType || '';
      accountDataTypeInput.required = !eventType;
      accountDataTypeInput.readOnly = Boolean(eventType);
    }
    if (accountDataContentInput) accountDataContentInput.value = '{\n  \n}';
    if (accountDataSave) accountDataSave.textContent = 'Save';

    if (eventType) {
      try {
        const data = await api(`/api/devtools/account-data/${encodeURIComponent(eventType)}`);
        if (accountDataContentInput) {
          accountDataContentInput.value = JSON.stringify(data.content ?? {}, null, 2);
        }
      } catch (error) {
        setAccountDataError(error.message || String(error));
      }
    }

    if (typeof accountDataDialog.showModal === 'function') {
      accountDataDialog.showModal();
      (eventType ? accountDataContentInput : accountDataTypeInput)?.focus();
    }
  }

  const EMOTICON_MAP = [
    [':)', '🙂'],
    [':-)', '🙂'],
    [':D', '😃'],
    [':-D', '😃'],
    [':(', '🙁'],
    [':-(', '🙁'],
    [':P', '😛'],
    [':-P', '😛'],
    [':p', '😛'],
    [':-p', '😛'],
    [';)', '😉'],
    [';-)', '😉'],
    [':O', '😮'],
    [':-O', '😮'],
    [':o', '😮'],
    [':/', '😕'],
    [':-/', '😕'],
    [':|', '😐'],
    [':-|', '😐'],
    ['<3', '❤️'],
    ['</3', '💔'],
    [':*', '😘'],
    [':-*', '😘'],
    ['xD', '😆'],
    ['XD', '😆'],
  ];

  function protectUrlsForEmoticons(text) {
    const urls = [];
    const protectedText = String(text || '').replace(/https?:\/\/[^\s<>"'\u00A0]+/gi, (match) => {
      const token = `\u0000URL${urls.length}\u0000`;
      urls.push(match);
      return token;
    });
    return { text: protectedText, urls };
  }

  function restoreProtectedUrls(text, urls) {
    return String(text || '').replace(/\u0000URL(\d+)\u0000/g, (_, index) => {
      return urls[Number(index)] || '';
    });
  }

  function convertTextEmoticons(text) {
    if (!text || !autoConvertEmoticonsEnabled()) return text;
    const { text: protectedText, urls } = protectUrlsForEmoticons(text);
    let next = protectedText;
    const sorted = [...EMOTICON_MAP].sort((a, b) => b[0].length - a[0].length);
    for (const [from, to] of sorted) {
      const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      next = next.replace(new RegExp(escaped, 'g'), to);
    }
    return restoreProtectedUrls(next, urls);
  }

  /** Repair older messages where `:/` in https:// became an emoticon. */
  function repairEmoticonBrokenUrls(text) {
    return String(text || '')
      .replace(/https?\p{Extended_Pictographic}\uFE0F?\/+/gu, 'https://')
      .replace(/https?:\/(?!\/)/g, 'https://');
  }

  function enterForNewlineEnabled() {
    return readBoolPref('relay.enterForNewline', false);
  }

  function legacyUsernameColorEnabled() {
    return readBoolPref('relay.legacyUsernameColor', false);
  }

  function urlPreviewEnabled() {
    return readBoolPref('relay.urlPreview', true);
  }

  function urlPreviewEncryptedEnabled() {
    return readBoolPref('relay.urlPreviewEncrypted', true);
  }

  function mediaAutoLoadDisabled() {
    return readBoolPref('relay.disableMediaAutoLoad', false);
  }

  function showHiddenEventsEnabled() {
    return readBoolPref('relay.showHiddenEvents', false);
  }

  function hideMembershipEnabled() {
    return readBoolPref('relay.hideMembership', false);
  }

  function hideProfileChangeEnabled() {
    return readBoolPref('relay.hideProfileChange', true);
  }

  function autoJoinSpaceRoomsEnabled() {
    return readBoolPref('relay.autoJoinSpaceRooms', true);
  }

  function scrollOnReselectMode() {
    return readStringPref('relay.scrollOnReselect', 'always');
  }

  function systemThemeEnabled() {
    return readBoolPref('relay.systemTheme', false);
  }

  const MONTH_SHORT = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const MONTH_LONG = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  function formatDatePart(date, pattern) {
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    const dd = String(d).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    switch (pattern) {
      case 'MMM D, YYYY':
        return `${MONTH_SHORT[date.getMonth()]} ${d}, ${y}`;
      case 'YYYY-MM-DD':
        return `${y}-${mm}-${dd}`;
      case 'DD/MM/YYYY':
        return `${dd}/${mm}/${y}`;
      case 'MM/DD/YYYY':
        return `${mm}/${dd}/${y}`;
      case 'D MMMM YYYY':
        return `${d} ${MONTH_LONG[date.getMonth()]} ${y}`;
      case 'D MMM YYYY':
      default:
        return `${d} ${MONTH_SHORT[date.getMonth()]} ${y}`;
    }
  }

  function formatMessageDayLabel(date) {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startThat = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    if (startThat === startToday) return 'Today';
    if (startThat === startToday - dayMs) return 'Yesterday';
    return formatDatePart(date, readStringPref('relay.dateFormat', 'D MMM YYYY'));
  }

  function formatMessageTimestamp(ts) {
    if (!ts) return '';
    try {
      const date = new Date(ts);
      const hour24 = readBoolPref('relay.hour24', false);
      const time = date.toLocaleTimeString(appLocale(), {
        hour: '2-digit',
        minute: '2-digit',
        hour12: !hour24,
      });
      return `${formatMessageDayLabel(date)} ${time}`;
    } catch {
      return '';
    }
  }

  function formatSystemTimestamp(ts) {
    if (!ts) return '';
    try {
      const date = new Date(ts);
      const hour24 = readBoolPref('relay.hour24', false);
      const time = date.toLocaleTimeString(appLocale(), {
        hour: 'numeric',
        minute: '2-digit',
        hour12: !hour24,
      });
      return `${formatDatePart(date, 'D MMM YYYY')} ${time}`;
    } catch {
      return '';
    }
  }

  function formatTimeOnly(ts) {
    if (!ts) return '';
    try {
      const date = new Date(ts);
      const hour24 = readBoolPref('relay.hour24', false);
      return date.toLocaleTimeString(appLocale(), {
        hour: 'numeric',
        minute: '2-digit',
        hour12: !hour24,
      });
    } catch {
      return '';
    }
  }

  function formatTimelineDayLabel(ts) {
    if (!ts) return '';
    try {
      return formatDatePart(new Date(ts), 'D MMMM YYYY');
    } catch {
      return '';
    }
  }

  function dayKeyFromTs(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function matrixLocalpart(userId) {
    const raw = String(userId || '');
    if (!raw.startsWith('@')) return raw;
    const cut = raw.indexOf(':');
    return cut > 1 ? raw.slice(1, cut) : raw.slice(1);
  }

  function systemEventIconSvg(action) {
    const icons = {
      join: '<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18"/>',
      leave: '<path d="M14 7l-5 5 5 5"/><path d="M9 12h12"/><path d="M3 3v18"/>',
      kick: '<path d="M14 7l-5 5 5 5"/><path d="M9 12h12"/><path d="M3 3v18"/>',
      ban: '<circle cx="12" cy="12" r="9"/><path d="M5 5l14 14"/>',
      invite: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
      profile: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
      profile_name: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
      profile_avatar: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
      room_name: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
      room_avatar: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
      room_topic: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      room_state: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
      membership: '<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18"/>',
    };
    return icons[action] || icons.membership;
  }

  function appendTimelineDaySeparator(ts) {
    const label = formatTimelineDayLabel(ts);
    if (!label || !messageList) return;
    const sep = document.createElement('div');
    sep.className = 'timeline-day-sep';
    sep.setAttribute('role', 'separator');
    const text = document.createElement('span');
    text.className = 'timeline-day-sep__label';
    text.textContent = label;
    sep.appendChild(text);
    messageList.appendChild(sep);
  }

  function appendRoomTimelineIntro(room) {
    if (!messageList || !room) return;
    const intro = document.createElement('div');
    intro.className = 'room-timeline-intro';

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'room-timeline-intro__avatar';
    const avatarSrc = room.avatarUrlLg || room.avatarUrl;
    if (room.hasAvatar !== false && avatarSrc) {
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.src = avatarSrc;
      img.addEventListener(
        'error',
        () => {
          img.replaceWith(Object.assign(document.createElement('span'), {
            className: 'room-timeline-intro__avatar-fallback',
            textContent: initials(room.name),
          }));
        },
        { once: true },
      );
      avatarWrap.appendChild(img);
    } else {
      const fallback = document.createElement('span');
      fallback.className = 'room-timeline-intro__avatar-fallback';
      fallback.textContent = initials(room.name);
      avatarWrap.appendChild(fallback);
    }

    const title = document.createElement('h2');
    title.className = 'room-timeline-intro__title';
    title.textContent = room.name || 'Room';

    const lead = document.createElement('p');
    lead.className = 'room-timeline-intro__lead';
    lead.textContent = 'This is the beginning of conversation.';

    intro.appendChild(avatarWrap);
    intro.appendChild(title);
    intro.appendChild(lead);

    if (room.creatorUserId || room.createdTs) {
      const meta = document.createElement('p');
      meta.className = 'room-timeline-intro__meta';
      const handle = room.creatorUserId
        ? `@${matrixLocalpart(room.creatorUserId)}`
        : 'someone';
      if (room.createdTs) {
        meta.textContent = `Created by ${handle} on ${formatTimelineDayLabel(room.createdTs)} ${formatTimeOnly(room.createdTs)}`;
      } else {
        meta.textContent = `Created by ${handle}`;
      }
      intro.appendChild(meta);
    }

    if (!room.isDirect) {
      const inviteBtn = document.createElement('button');
      inviteBtn.type = 'button';
      inviteBtn.className = 'room-timeline-intro__invite';
      inviteBtn.textContent = 'Invite Member';
      inviteBtn.addEventListener('click', () => {
        openInviteDialog({ kind: 'room', id: room.roomId, name: room.name || 'room' });
      });
      intro.appendChild(inviteBtn);
    }

    messageList.appendChild(intro);
  }

  function appendSystemMessage(msg) {
    const el = document.createElement('article');
    el.className = 'message message--system';
    if (msg.eventId) el.dataset.eventId = msg.eventId;

    const icon = document.createElement('span');
    icon.className = 'message--system__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `<svg class="ui-icon ui-icon--stroke" viewBox="0 0 24 24">${systemEventIconSvg(msg.systemAction || 'membership')}</svg>`;

    const bodyEl = document.createElement('div');
    bodyEl.className = 'body';
    bodyEl.textContent = msg.body || 'Room update';

    const when = document.createElement('time');
    when.className = 'message--system__when';
    when.textContent = formatSystemTimestamp(msg.ts);

    el.appendChild(icon);
    el.appendChild(bodyEl);
    el.appendChild(when);
    messageList.appendChild(el);
  }

  function applyMessageLayoutPrefs() {
    if (!messageList) return;
    messageList.dataset.layout = readStringPref('relay.messageLayout', 'modern');
    messageList.dataset.spacing = readStringPref('relay.messageSpacing', 'normal');
  }

  function applyMonochromePref() {
    document.documentElement.classList.toggle('monochrome', readBoolPref('relay.monochrome', false));
  }

  function appLanguagePref() {
    return window.RelayI18n?.normalizeLang(readStringPref('relay.language', 'system')) || 'system';
  }

  function appLocale() {
    return window.RelayI18n?.resolveLang(appLanguagePref()) || 'en';
  }

  function t(key) {
    return window.RelayI18n?.t(key, appLanguagePref()) || key;
  }

  function applyLanguagePref() {
    const pref = appLanguagePref();
    if (prefLanguage) prefLanguage.value = pref;
    window.RelayI18n?.applyDom(pref);
    if (prefTextSize) {
      for (const opt of prefTextSize.options) {
        const key = `size.${opt.value}`;
        const label = t(key);
        if (label && label !== key) opt.textContent = label;
      }
    }
    if (prefLanguage) {
      for (const opt of prefLanguage.options) {
        if (opt.value === 'system') {
          opt.textContent = t('lang.system');
        } else if (window.RelayI18n?.LOCALES?.[opt.value]?.name) {
          opt.textContent = window.RelayI18n.LOCALES[opt.value].name;
        }
      }
      prefLanguage.value = pref;
    }
  }

  function applyTextSizePref() {
    const size = readStringPref('relay.textSize', 'normal');
    const safe = window.RelayI18n?.TEXT_SCALES?.[size] ? size : 'normal';
    window.RelayI18n?.applyTextSize(safe);
    if (prefTextSize) prefTextSize.value = safe;
  }

  function applyPageZoomPref() {
    const raw = Number(readStringPref('relay.pageZoom', '100'));
    const zoom = Math.max(75, Math.min(150, Number.isFinite(raw) ? raw : 100));
    document.documentElement.style.zoom = `${zoom}%`;
    if (prefPageZoom) prefPageZoom.value = String(zoom);
  }

  function resolveThemeForSystem() {
    const prefersLight =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: light)').matches;
    if (prefersLight) return 'light';
    const stored = coerceTheme(localStorage.getItem('relay.theme') || 'dark');
    if (stored === 'light') return 'dark';
    return stored;
  }

  function refreshActiveTheme() {
    if (systemThemeEnabled()) {
      applyTheme(resolveThemeForSystem(), { persist: false });
    } else {
      applyTheme(localStorage.getItem('relay.theme') || 'dark');
    }
  }

  function loadAppearancePrefs() {
    if (prefSystemTheme) prefSystemTheme.checked = systemThemeEnabled();
    if (prefMonochrome) prefMonochrome.checked = readBoolPref('relay.monochrome', false);
    if (prefPageZoom) prefPageZoom.value = readStringPref('relay.pageZoom', '100');
    if (prefTextSize) prefTextSize.value = readStringPref('relay.textSize', 'normal');
    applyMonochromePref();
    applyTextSizePref();
    applyPageZoomPref();
    populateThemeSelect();
  }

  function loadGeneralPrefs() {
    if (prefLanguage) prefLanguage.value = appLanguagePref();
    applyLanguagePref();
    if (prefEnterForNewline) prefEnterForNewline.checked = readBoolPref('relay.enterForNewline', false);
    if (prefMarkdownFormatting) {
      prefMarkdownFormatting.checked = readBoolPref('relay.markdownFormatting', true);
    }
    applySpellcheckPref();
    if (prefHideActivity) prefHideActivity.checked = readBoolPref('relay.hideActivity', false);
    if (prefHour24) prefHour24.checked = readBoolPref('relay.hour24', false);
    if (prefDateFormat) prefDateFormat.value = readStringPref('relay.dateFormat', 'D MMM YYYY');
    if (prefAutoJoinSpaceRooms) {
      prefAutoJoinSpaceRooms.checked = autoJoinSpaceRoomsEnabled();
    }
    if (prefMessageLayout) {
      prefMessageLayout.value = readStringPref('relay.messageLayout', 'modern');
    }
    if (prefMessageSpacing) {
      prefMessageSpacing.value = readStringPref('relay.messageSpacing', 'normal');
    }
    if (prefScrollOnReselect) {
      prefScrollOnReselect.value = scrollOnReselectMode();
    }
    if (prefLegacyUsernameColor) {
      prefLegacyUsernameColor.checked = legacyUsernameColorEnabled();
    }
    if (prefHideMembership) prefHideMembership.checked = hideMembershipEnabled();
    if (prefHideProfileChange) {
      prefHideProfileChange.checked = hideProfileChangeEnabled();
    }
    if (prefDisableMediaAutoLoad) {
      prefDisableMediaAutoLoad.checked = mediaAutoLoadDisabled();
    }
    if (prefUrlPreview) prefUrlPreview.checked = urlPreviewEnabled();
    if (prefUrlPreviewEncrypted) {
      prefUrlPreviewEncrypted.checked = urlPreviewEncryptedEnabled();
    }
    if (prefShowHiddenEvents) {
      prefShowHiddenEvents.checked = showHiddenEventsEnabled();
    }
    applyMessageLayoutPrefs();
  }

  function formatDeviceSeen(ts) {
    if (!ts) return '';
    try {
      const date = new Date(ts);
      const now = new Date();
      const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
      const time = date.toLocaleTimeString(appLocale(), {
        hour: 'numeric',
        minute: '2-digit',
        hour12: !readBoolPref('relay.hour24', false),
      });
      if (sameDay) return `Today ${time}`;
      return `${formatDatePart(date, readStringPref('relay.dateFormat', 'D MMM YYYY'))} ${time}`;
    } catch {
      return '';
    }
  }

  async function renameDevicePrompt(device) {
    const next = window.prompt('Device display name', device.displayName || '');
    if (next == null) return;
    const trimmed = String(next).trim();
    if (!trimmed) return;
    await api(`/api/devices/${encodeURIComponent(device.deviceId)}`, {
      method: 'PUT',
      body: JSON.stringify({ displayName: trimmed }),
    });
    await refreshDevicesSettings();
  }

  function setAccountPasswordError(message) {
    if (!accountPasswordError) return;
    const text = String(message || '').trim();
    accountPasswordError.hidden = !text;
    accountPasswordError.textContent = text;
  }

  function closeAccountPasswordDialog() {
    if (accountPasswordDialog?.open) accountPasswordDialog.close();
  }

  /** Homeserver UIA: password confirm for device delete / sensitive actions. */
  function promptAccountPassword({
    title = 'Confirm password',
    topic = 'Enter your account password to continue.',
  } = {}) {
    return new Promise((resolve) => {
      if (!accountPasswordDialog || !accountPasswordForm || !accountPasswordInput) {
        const fallback = window.prompt(topic);
        resolve(fallback == null || !String(fallback) ? null : String(fallback));
        return;
      }

      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        accountPasswordForm.removeEventListener('submit', onSubmit);
        accountPasswordCancel?.removeEventListener('click', onCancel);
        accountPasswordDialog.removeEventListener('close', onClose);
        resolve(value);
      };

      const onCancel = () => {
        closeAccountPasswordDialog();
        finish(null);
      };
      const onClose = () => finish(null);
      const onSubmit = (event) => {
        event.preventDefault();
        const password = String(accountPasswordInput.value || '');
        if (!password) {
          setAccountPasswordError('Password is required');
          accountPasswordInput.focus();
          return;
        }
        setAccountPasswordError('');
        finish(password);
        closeAccountPasswordDialog();
      };

      if (accountPasswordTitle) accountPasswordTitle.textContent = title;
      if (accountPasswordTopic) accountPasswordTopic.textContent = topic;
      accountPasswordInput.value = '';
      setAccountPasswordError('');
      if (accountPasswordSubmit) accountPasswordSubmit.disabled = false;

      accountPasswordForm.addEventListener('submit', onSubmit);
      accountPasswordCancel?.addEventListener('click', onCancel);
      accountPasswordDialog.addEventListener('close', onClose);

      if (typeof accountPasswordDialog.showModal === 'function') {
        accountPasswordDialog.showModal();
        accountPasswordInput.focus();
      } else {
        finish(null);
      }
    });
  }

  async function apiJson(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error || res.statusText || 'Request failed');
      error.status = res.status;
      error.data = data;
      error.needsPassword = Boolean(data.needsPassword);
      throw error;
    }
    return data;
  }

  async function removeDevicesWithPassword(deviceIds, { label } = {}) {
    const ids = (Array.isArray(deviceIds) ? deviceIds : []).filter(Boolean);
    if (!ids.length) return null;

    const attempt = async (password) => {
      return apiJson('/api/devices/delete', {
        method: 'POST',
        body: JSON.stringify({ deviceIds: ids, password: password || null }),
      });
    };

    try {
      return await attempt(null);
    } catch (error) {
      if (!error?.needsPassword && error?.status !== 401) throw error;
      const password = await promptAccountPassword({
        title: 'Confirm password',
        topic:
          label ||
          (ids.length === 1
            ? 'Enter your account password to remove this device.'
            : `Enter your account password to remove ${ids.length} devices.`),
      });
      if (!password) return null;
      return attempt(password);
    }
  }

  function buildDeviceRow(
    device,
    { current = false, canVerifyOthers = false, showOtherVerification = false } = {},
  ) {
    const row = document.createElement('div');
    row.className = `device-row${current ? ' is-current' : ''}`;

    const main = document.createElement('div');
    main.className = 'device-row-main';
    const name = document.createElement('strong');
    name.textContent = device.displayName || device.deviceId;
    const meta = document.createElement('span');
    meta.className = 'settings-muted';
    const seen = formatDeviceSeen(device.lastSeenTs);
    meta.textContent = seen || device.deviceId;
    meta.title = [device.deviceId, device.lastSeenIp].filter(Boolean).join(' · ');
    main.append(name, meta);

    const actions = document.createElement('div');
    actions.className = 'device-row-actions';

    if (current) {
      const logout = document.createElement('button');
      logout.type = 'button';
      logout.className = 'ghost danger-text';
      logout.textContent = 'Logout';
      logout.addEventListener('click', () => {
        if (!window.confirm('Log out of Kitsu on this device?')) return;
        void doLogout();
      });
      actions.append(logout);
    } else {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ghost danger-text';
      remove.textContent = 'Remove';
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Sign out device “${device.displayName || device.deviceId}”?`)) {
          return;
        }
        try {
          const result = await removeDevicesWithPassword([device.deviceId], {
            label: `Enter your account password to remove “${device.displayName || device.deviceId}”.`,
          });
          if (!result) return;
          await refreshDevicesSettings();
          void refreshSecurityBadge();
        } catch (error) {
          window.alert(error.message || String(error));
        }
      });
      actions.append(remove);
    }

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'ghost';
    edit.textContent = 'Edit';
    edit.addEventListener('click', async () => {
      try {
        await renameDevicePrompt(device);
      } catch (error) {
        window.alert(error.message || String(error));
      }
    });
    actions.append(edit);

    row.append(main, actions);

    // Current device: show Unverified card while this session needs verification.
    // Other devices: only after this session is verified (Paarrot behaviour).
    const showUnverifiedCard =
      (current && !device.verified) ||
      (!current && showOtherVerification && !device.verified);
    if (showUnverifiedCard) {
      const card = document.createElement('div');
      card.className = 'device-unverified-card';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = 'Unverified';
      const body = document.createElement('p');
      body.textContent = current
        ? 'Start verification with your recovery key to trust this device.'
        : 'Verify device identity and grant access to encrypted messages';
      copy.append(title, body);
      const verify = document.createElement('button');
      verify.type = 'button';
      verify.className = 'device-verify-action';
      verify.textContent = current ? 'Verify' : 'Verify';
      if (current) {
        verify.addEventListener('click', () => {
          void runCryptoSetup();
        });
      } else {
        verify.disabled = !canVerifyOthers;
        verify.title = canVerifyOthers
          ? 'Cross-sign this device'
          : 'Verify this Kitsu device first';
        verify.addEventListener('click', async () => {
          try {
            await openSasVerifyDialog(device.deviceId);
            await refreshDevicesSettings();
            void refreshSecurityBadge();
          } catch (error) {
            window.alert(error.message || String(error));
          }
        });
      }
      card.append(copy, verify);
      const wrap = document.createElement('div');
      wrap.className = 'device-row-wrap';
      wrap.append(row, card);
      return wrap;
    }

    return row;
  }

  function updateSecurityBadge({
    unverifiedCount = 0,
    currentDeviceUnverified = false,
    loggedIn = true,
  } = {}) {
    const n = Math.max(0, Number(unverifiedCount) || 0);
    const alert = Boolean(loggedIn) && (currentDeviceUnverified || n > 0);
    if (railSecurityBadge) {
      // Match Paarrot rail: number badge only for other unverified devices after
      // this session is verified. Current-unverified = shield alert, no count.
      if (!currentDeviceUnverified && n > 0) {
        railSecurityBadge.hidden = false;
        railSecurityBadge.textContent = n > 99 ? '99+' : String(n);
      } else {
        railSecurityBadge.hidden = true;
        railSecurityBadge.textContent = '0';
      }
    }
    if (railSecurityBtn) {
      // Hide entirely when everything is verified (Paarrot UnverifiedTab).
      railSecurityBtn.hidden = !alert;
      railSecurityBtn.classList.toggle('has-alert', alert);
      railSecurityBtn.classList.toggle('is-current-unverified', currentDeviceUnverified);
      railSecurityBtn.title = currentDeviceUnverified
        ? 'Devices & security · this device is unverified'
        : n > 0
          ? `Devices & security · ${n} unverified`
          : 'Devices & security';
      if (!alert) railSecurityBtn.classList.remove('is-active');
    }
  }

  async function refreshSecurityBadge() {
    if (!railSecurityBtn) return;
    if (railAccountBtn?.hidden) {
      updateSecurityBadge({ loggedIn: false });
      return;
    }
    try {
      const data = await api('/api/devices');
      updateSecurityBadge({
        unverifiedCount: data.unverifiedCount ?? data.security?.unverifiedCount ?? 0,
        currentDeviceUnverified: Boolean(
          data.currentDeviceUnverified ?? data.security?.currentDeviceUnverified,
        ),
        loggedIn: true,
      });
    } catch {
      // ignore while logged out / crypto starting
    }
  }

  async function openDevicesSettings() {
    await openSettings({ tab: 'devices', fromSecurity: true });
  }

  function applyStickerPackState(data) {
    stickerPackState = data || null;
    const packs = Array.isArray(data?.packs) ? data.packs : [];
    const defaultId = data?.defaultPackId || 'builtin-emoji';
    const favoriteIds = Array.isArray(data?.favoritePackIds) ? data.favoritePackIds : [];
    const defaultPack = packs.find((pack) => pack.id === defaultId) || packs[0];
    if (defaultPackName) defaultPackName.textContent = defaultPack?.name || 'Unknown';

    if (telegramBotTokenInput && document.activeElement !== telegramBotTokenInput) {
      telegramBotTokenInput.value = data?.telegramBotToken || '';
    }
    syncTelegramImportEnabled();

    if (favoritePackList) {
      favoritePackList.replaceChildren();
      const favorites = packs.filter((pack) => favoriteIds.includes(pack.id) && !pack.builtin);
      favoritePackList.hidden = favorites.length === 0;
      for (const pack of favorites) {
        const li = document.createElement('li');
        li.textContent = pack.name || pack.id;
        favoritePackList.append(li);
      }
    }
  }

  function syncTelegramImportEnabled() {
    if (!telegramImportBtn) return;
    const token = String(telegramBotTokenInput?.value || '').trim();
    const url = String(telegramPackUrlInput?.value || '').trim();
    telegramImportBtn.disabled = !(token && url);
  }

  async function refreshEmojiStickerSettings() {
    if (prefAutoConvertEmoticons) {
      prefAutoConvertEmoticons.checked = autoConvertEmoticonsEnabled();
    }
    try {
      const data = await api('/api/stickers');
      applyStickerPackState(data);
    } catch (error) {
      if (telegramImportStatus) {
        telegramImportStatus.textContent = error.message || String(error);
      }
    }
  }

  function getComposerStickerEntries(query = '') {
    const q = query.trim().toLowerCase();
    const packs = Array.isArray(stickerPackState?.packs) ? stickerPackState.packs : [];
    const favoriteIds = Array.isArray(stickerPackState?.favoritePackIds)
      ? stickerPackState.favoritePackIds
      : [];
    const imagePacks = packs.filter((pack) => !pack.builtin && (pack.stickers || []).length > 0);
    const preferred = imagePacks.filter((pack) => favoriteIds.includes(pack.id));
    const fallback = imagePacks.filter((pack) => pack.id === stickerPackState?.defaultPackId);
    const selected = preferred.length ? preferred : fallback.length ? fallback : imagePacks;
    /** @type {Array<{ kind: 'image', value: string, label: string, fileName?: string }>} */
    const entries = [];
    for (const pack of selected) {
      for (const sticker of pack.stickers || []) {
        const label = `${sticker.emoji || ''} ${pack.name || ''}`.toLowerCase();
        if (q && !label.includes(q) && !String(sticker.fileName || '').toLowerCase().includes(q)) {
          continue;
        }
        const file = String(sticker.fileName || '');
        if (/\.(tgs)$/i.test(file)) continue;
        entries.push({
          kind: 'image',
          value: sticker.url,
          label: sticker.emoji || pack.name || 'sticker',
          fileName: file || 'sticker.webp',
        });
      }
    }
    return entries;
  }

  function openStickerPackView(packId) {
    const packs = Array.isArray(stickerPackState?.packs) ? stickerPackState.packs : [];
    const pack = packs.find((entry) => entry.id === packId) || packs[0];
    if (!pack || !stickerPackViewDialog || !stickerPackViewGrid) return;
    viewingPackId = pack.id;
    if (stickerPackViewTitle) stickerPackViewTitle.textContent = pack.name || 'Pack';
    stickerPackViewGrid.replaceChildren();
    if (pack.builtin) {
      for (const emoji of STICKERS) {
        const item = document.createElement('div');
        item.className = 'sticker-pack-view-item';
        item.textContent = emoji;
        stickerPackViewGrid.append(item);
      }
    } else {
      for (const sticker of pack.stickers || []) {
        if (/\.(tgs)$/i.test(String(sticker.fileName || ''))) continue;
        const item = document.createElement('div');
        item.className = 'sticker-pack-view-item';
        const img = document.createElement('img');
        img.src = sticker.url;
        img.alt = sticker.emoji || pack.name || 'sticker';
        item.append(img);
        stickerPackViewGrid.append(item);
      }
    }
    if (typeof stickerPackViewDialog.showModal === 'function') {
      stickerPackViewDialog.showModal();
    }
  }

  function openFavoritePackDialog() {
    if (!favoritePackDialog || !favoritePackOptions) return;
    const packs = Array.isArray(stickerPackState?.packs) ? stickerPackState.packs : [];
    const favoriteIds = new Set(stickerPackState?.favoritePackIds || []);
    favoritePackOptions.replaceChildren();
    if (favoritePackError) {
      favoritePackError.hidden = true;
      favoritePackError.textContent = '';
    }
    for (const pack of packs) {
      if (pack.builtin) continue;
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = pack.id;
      input.checked = favoriteIds.has(pack.id);
      label.append(input, document.createTextNode(pack.name || pack.id));
      favoritePackOptions.append(label);
    }
    if (typeof favoritePackDialog.showModal === 'function') {
      favoritePackDialog.showModal();
    }
  }

  function setCryptoSetupError(message) {
    if (!cryptoSetupError) return;
    const text = String(message || '').trim();
    cryptoSetupError.hidden = !text;
    cryptoSetupError.textContent = text;
  }

  function closeCryptoSetupDialog() {
    if (cryptoSetupDialog?.open) cryptoSetupDialog.close();
  }

  /**
   * Ask for recovery key. Electron has no window.prompt.
   * @returns {Promise<{ recoveryKey: string } | null>}
   */
  function promptCryptoCredentials({ reset = false } = {}) {
    return new Promise((resolve) => {
      if (!cryptoSetupDialog || !cryptoSetupForm || !cryptoSetupRecoveryKey) {
        window.alert('Encryption setup dialog is missing. Restart Kitsu.');
        resolve(null);
        return;
      }

      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        cryptoSetupForm.removeEventListener('submit', onSubmit);
        cryptoSetupCancel?.removeEventListener('click', onCancel);
        cryptoSetupDialog.removeEventListener('close', onClose);
        resolve(value);
      };

      const onCancel = () => {
        closeCryptoSetupDialog();
        finish(null);
      };
      const onClose = () => finish(null);
      const onSubmit = (event) => {
        event.preventDefault();
        const recoveryKey = String(cryptoSetupRecoveryKey.value || '').trim();
        if (!recoveryKey) {
          setCryptoSetupError('Recovery key is required');
          cryptoSetupRecoveryKey.focus();
          return;
        }
        setCryptoSetupError('');
        finish({ recoveryKey });
        closeCryptoSetupDialog();
      };

      if (cryptoSetupTitle) {
        cryptoSetupTitle.textContent = reset
          ? 'Reset encryption'
          : 'Set up encryption';
      }
      cryptoSetupRecoveryKey.value = '';
      setCryptoSetupError('');
      if (cryptoSetupSubmit) cryptoSetupSubmit.disabled = false;

      cryptoSetupForm.addEventListener('submit', onSubmit);
      cryptoSetupCancel?.addEventListener('click', onCancel);
      cryptoSetupDialog.addEventListener('close', onClose);

      if (typeof cryptoSetupDialog.showModal === 'function') {
        cryptoSetupDialog.showModal();
        cryptoSetupRecoveryKey.focus();
      } else {
        finish(null);
      }
    });
  }

  async function runCryptoSetup({ reset = false } = {}) {
    const credentials = await promptCryptoCredentials({ reset });
    if (!credentials) return null;

    if (deviceSecurityNote) {
      deviceSecurityNote.hidden = false;
      deviceSecurityNote.textContent = 'Setting up encryption…';
    }
    if (deviceVerificationBtn) deviceVerificationBtn.disabled = true;
    if (deviceBackupSetupBtn) deviceBackupSetupBtn.disabled = true;
    try {
      const data = await api('/api/crypto/setup', {
        method: 'POST',
        body: JSON.stringify({
          recoveryKey: credentials.recoveryKey,
          resetCrossSigning: Boolean(reset),
          setupBackup: true,
        }),
      });
      await refreshDevicesSettings();
      if (activeRoomId) void refreshMessages(activeRoomId, { quiet: true });
      return data;
    } catch (error) {
      window.alert(error.message || String(error));
      await refreshDevicesSettings();
      return null;
    }
  }

  async function refreshDevicesSettings() {
    if (!devicesCurrentList || !devicesOthersList) return;
    if (devicesStatus) devicesStatus.textContent = 'Loading devices…';
    devicesCurrentList.replaceChildren();
    devicesOthersList.replaceChildren();
    try {
      const data = await api('/api/devices');
      const devices = Array.isArray(data.devices) ? data.devices : [];
      const current = devices.filter((device) => device.isCurrent);
      const others = devices.filter((device) => !device.isCurrent);
      const security = data.security || {};
      const showOtherVerification = Boolean(
        data.showOtherVerification ?? security.showOtherVerification,
      );
      const canVerifyOthers =
        Boolean(security.cryptoEnabled) &&
        Boolean(security.crossSigningReady) &&
        security.verification === 'verified';

      updateSecurityBadge({
        unverifiedCount: data.unverifiedCount ?? security.unverifiedCount ?? 0,
        currentDeviceUnverified: Boolean(
          data.currentDeviceUnverified ?? security.currentDeviceUnverified,
        ),
      });

      if (deviceVerificationBtn) {
        deviceVerificationBtn.textContent = security.verificationLabel || 'Unavailable';
        deviceVerificationBtn.classList.toggle('is-verified', security.verification === 'verified');
        deviceVerificationBtn.classList.toggle(
          'is-unverified',
          security.verification === 'unverified' || security.verification === 'set-up',
        );
        const canSetup = Boolean(security.cryptoEnabled) && security.verification !== 'verified';
        deviceVerificationBtn.disabled = !canSetup;
        deviceVerificationBtn.title = !security.cryptoEnabled
          ? 'Crypto is not available yet'
          : security.verification === 'verified'
            ? 'This device is verified'
            : 'Verify this device';
      }
      if (deviceVerificationMenuBtn) {
        deviceVerificationMenuBtn.disabled = !security.cryptoEnabled;
      }
      hideDeviceVerificationMenu();
      if (deviceSecurityNote) {
        deviceSecurityNote.textContent = security.note || '';
        deviceSecurityNote.hidden = !security.note;
      }
      if (deviceBackupRow) {
        deviceBackupRow.hidden = !security.cryptoEnabled;
        deviceBackupRow.classList.toggle('is-connected', security.keyBackup === 'connected');
        if (deviceBackupLabel) {
          deviceBackupLabel.textContent =
            security.keyBackup === 'connected'
              ? 'Connected'
              : security.keyBackupLabel || 'Not connected';
        }
        if (deviceBackupSetupBtn) {
          deviceBackupSetupBtn.hidden =
            !security.cryptoEnabled || security.keyBackup === 'connected';
        }
      }

      if (!current.length) {
        const empty = document.createElement('p');
        empty.className = 'settings-muted';
        empty.textContent = 'Current device not found.';
        devicesCurrentList.append(empty);
      } else {
        for (const device of current) {
          devicesCurrentList.append(
            buildDeviceRow(device, { current: true, canVerifyOthers, showOtherVerification }),
          );
        }
      }

      if (!others.length) {
        const empty = document.createElement('p');
        empty.className = 'settings-muted';
        empty.textContent = 'No other devices.';
        devicesOthersList.append(empty);
      } else {
        for (const device of others) {
          devicesOthersList.append(
            buildDeviceRow(device, { current: false, canVerifyOthers, showOtherVerification }),
          );
        }
      }

      const unverifiedOthers = others.filter((device) => !device.verified);
      if (removeUnverifiedDevicesBtn) {
        const showBulk = showOtherVerification && unverifiedOthers.length > 0;
        removeUnverifiedDevicesBtn.hidden = !showBulk;
        removeUnverifiedDevicesBtn.textContent =
          unverifiedOthers.length > 1
            ? `Remove unverified (${unverifiedOthers.length})`
            : 'Remove unverified';
        removeUnverifiedDevicesBtn.dataset.deviceIds = JSON.stringify(
          unverifiedOthers.map((device) => device.deviceId),
        );
      }

      if (devicesStatus) {
        devicesStatus.textContent = `${devices.length} device${devices.length === 1 ? '' : 's'}`;
      }
    } catch (error) {
      if (removeUnverifiedDevicesBtn) removeUnverifiedDevicesBtn.hidden = true;
      if (devicesStatus) devicesStatus.textContent = error.message || String(error);
    }
  }

  function clearRelayCachesAndReload() {
    try {
      const keep = [
        'relay.theme',
        'relay.theme-scheme',
        'relay.homeserver',
        'relay.user',
        'relay.twitterEmoji',
        'relay.enterForNewline',
        'relay.markdownFormatting',
        'relay.hideActivity',
        'relay.hour24',
        'relay.dateFormat',
        'relay.autoJoinSpaceRooms',
        'relay.messageLayout',
        'relay.messageSpacing',
        'relay.scrollOnReselect',
        'relay.legacyUsernameColor',
        'relay.hideMembership',
        'relay.hideProfileChange',
        'relay.disableMediaAutoLoad',
        'relay.urlPreview',
        'relay.urlPreviewEncrypted',
        'relay.showHiddenEvents',
        'relay.systemTheme',
        'relay.monochrome',
        'relay.pageZoom',
        'relay.language',
        'relay.textSize',
        'relay.media.audioInput',
        'relay.media.audioOutput',
        'relay.media.noiseSuppression',
        'relay.media.echoCancellation',
        'relay.media.autoGainControl',
        'relay.media.screenResolution',
        'relay.media.screenBitrate',
        'relay.media.screenFps',
        'relay.media.showRemoteCursor',
        'relay.notifications',
        'relay.notifications.messages',
        'relay.notifications.invites',
        'relay.notifications.sounds',
        'relay.lastRoomId',
        'relay.lastRoomSpace',
        'relay.space',
        'relay.spaceOrder',
        'relay.spaceFolders',
        'relay.hiddenSpaces',
        'relay.membersDrawer',
      ];
      const preserved = {};
      for (const key of keep) {
        const value = localStorage.getItem(key);
        if (value != null) preserved[key] = value;
      }
      const themeCssKeys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith('relay.theme-css:')) themeCssKeys.push(key);
      }
      for (const key of themeCssKeys) localStorage.removeItem(key);
      localStorage.clear();
      for (const [key, value] of Object.entries(preserved)) {
        localStorage.setItem(key, value);
      }
    } catch {
      // ignore
    }
    window.location.reload();
  }

  function updateNotificationsStatus() {
    if (!notificationsStatus) return;
    if (!readNotifPref('relay.notifications', true)) {
      notificationsStatus.textContent = 'Notifications are off.';
      return;
    }
    if (window.relayDesktop?.isDesktop) {
      notificationsStatus.textContent = 'Desktop notifications ready.';
      return;
    }
    if (typeof Notification === 'undefined') {
      notificationsStatus.textContent = 'Notifications are not supported in this browser.';
      return;
    }
    notificationsStatus.textContent = `Browser permission: ${Notification.permission}`;
  }

  async function ensureNotificationPermission() {
    if (window.relayDesktop?.isDesktop) return true;
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    updateNotificationsStatus();
    return result === 'granted';
  }

  function truncateNotifBody(value, max = 140) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
  }

  /** @type {Map<string, Notification[]>} */
  const browserNotificationsByRoom = new Map();

  function clearRoomNotifications(roomId = null) {
    if (window.relayDesktop?.clearNotifications) {
      void window.relayDesktop.clearNotifications(roomId ? { roomId } : {});
    }
    if (roomId) {
      const list = browserNotificationsByRoom.get(roomId) || [];
      for (const notification of list) {
        try {
          notification.close();
        } catch {
          // ignore
        }
      }
      browserNotificationsByRoom.delete(roomId);
      return;
    }
    for (const list of browserNotificationsByRoom.values()) {
      for (const notification of list) {
        try {
          notification.close();
        } catch {
          // ignore
        }
      }
    }
    browserNotificationsByRoom.clear();
  }

  function zeroLocalUnread(roomId) {
    if (!roomId) return;
    const room = roomCatalog.find((entry) => entry.roomId === roomId);
    if (room) room.unread = 0;
  }

  async function showDesktopNotification({ title, body, roomId, sound = 'notification' }) {
    if (!readNotifPref('relay.notifications', true)) return;
    const allowed = await ensureNotificationPermission();
    if (!allowed && !window.relayDesktop?.showNotification) return;

    if (sound) playRelaySound(sound);

    if (window.relayDesktop?.showNotification) {
      await window.relayDesktop.showNotification({ title, body, roomId });
      return;
    }

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const notification = new Notification(title, {
      body,
      // App plays Material sound; keep OS toast silent when sounds are on.
      silent: readNotifPref('relay.notifications.sounds', true),
    });
    if (roomId) {
      const list = browserNotificationsByRoom.get(roomId) || [];
      list.push(notification);
      browserNotificationsByRoom.set(roomId, list);
      notification.onclose = () => {
        const next = (browserNotificationsByRoom.get(roomId) || []).filter((entry) => entry !== notification);
        if (next.length) browserNotificationsByRoom.set(roomId, next);
        else browserNotificationsByRoom.delete(roomId);
      };
    }
    notification.onclick = () => {
      window.focus();
      if (roomId) void openRoomFromNotification(roomId);
      notification.close();
    };
  }

  async function shouldSuppressNotification(roomId, item = null) {
    const level = getRoomNotifLevel(roomId);
    if (level === 'mute' || getMutedRooms().has(roomId)) return true;
    if (level === 'mentions' && item && item.kind === 'message' && !item.highlight) return true;
    const focused = window.relayDesktop?.isWindowFocused
      ? await window.relayDesktop.isWindowFocused()
      : document.hasFocus() && !document.hidden;
    if (focused && activeRoomId === roomId && !document.hidden) return true;
    return false;
  }

  async function handleActivityItem(item) {
    if (!item?.roomId) return;
    if (item.kind === 'message' && !readNotifPref('relay.notifications.messages', true)) return;
    if (item.kind === 'invite' && !readNotifPref('relay.notifications.invites', true)) return;
    if (await shouldSuppressNotification(item.roomId, item)) return;

    if (item.kind === 'invite') {
      await showDesktopNotification({
        title: 'Invite',
        body: `${item.senderName || 'Someone'} invited you to ${item.roomName || 'a room'}`,
        roomId: item.roomId,
        sound: 'invite',
      });
      void refreshInvites();
      return;
    }

    const who = item.senderName || 'Someone';
    const title = item.isDirect ? who : item.roomName || 'Kitsu';
    const body = item.isDirect
      ? truncateNotifBody(item.body || 'New message')
      : truncateNotifBody(`${who}: ${item.body || 'New message'}`);
    await showDesktopNotification({ title, body, roomId: item.roomId, sound: 'notification' });
  }

  async function pollActivity({ bootstrap = false } = {}) {
    try {
      const data = await api(`/api/activity?since=${encodeURIComponent(activityCursor)}`);
      const items = data.items || [];
      activityCursor = Number(data.cursor) || activityCursor;
      if (bootstrap || !activityReady) {
        activityReady = true;
        return;
      }
      for (const item of items) {
        await handleActivityItem(item);
      }
    } catch {
      // ignore while logged out
    }
  }

  function persistLastRoom(roomId = activeRoomId) {
    if (!roomId) return;
    localStorage.setItem('relay.lastRoomId', roomId);
    localStorage.setItem('relay.lastRoomSpace', activeSpaceFilter || 'dms');
  }

  let controlRoomSyncTimer = 0;
  let lastSyncedControlRoom = undefined;
  function syncControlRoom(roomId = activeRoomId) {
    const next = roomId || null;
    if (next === lastSyncedControlRoom) return;
    clearTimeout(controlRoomSyncTimer);
    controlRoomSyncTimer = setTimeout(() => {
      if (next === lastSyncedControlRoom) return;
      lastSyncedControlRoom = next;
      void api('/api/control/room', {
        method: 'PUT',
        body: JSON.stringify({ roomId: next }),
      }).catch(() => {
        lastSyncedControlRoom = undefined;
      });
    }, 80);
  }

  let callControlSyncTimer = 0;
  let lastSyncedCallKey = '';
  function syncCallControl(event = {}) {
    clearTimeout(callControlSyncTimer);
    callControlSyncTimer = setTimeout(() => {
      const snap = window.RelayVoip?.getSnapshot?.() || {};
      const state = event.state || snap.state || 'idle';
      const inCall = state !== 'idle' && state !== 'ended';
      const muted =
        typeof snap.isMuted === 'boolean'
          ? snap.isMuted
          : typeof snap.muted === 'boolean'
            ? snap.muted
            : Boolean(event.muted);
      const deafened =
        typeof snap.isDeafened === 'boolean'
          ? snap.isDeafened
          : typeof snap.deafened === 'boolean'
            ? snap.deafened
            : Boolean(event.deafened);
      const roomId = event.roomId || snap.roomId || null;
      const key = `${muted}|${deafened}|${inCall}|${roomId || ''}`;
      if (key === lastSyncedCallKey) return;
      lastSyncedCallKey = key;
      void api('/api/control/call', {
        method: 'PUT',
        body: JSON.stringify({ muted, deafened, inCall, roomId }),
      }).catch(() => {
        lastSyncedCallKey = '';
      });
    }, 80);
  }

  function handlePaarrotControl(data) {
    const action = String(data?.action || '');
    if (action === 'change-channel' && data.roomId) {
      void openRoomEntry({ roomId: data.roomId, name: data.roomId });
      return;
    }
    if (action === 'set-mute') {
      window.RelayVoip?.setMute?.(Boolean(data.muted));
      syncCallControl({ muted: Boolean(data.muted) });
      updateCallChrome();
      return;
    }
    if (action === 'set-deafen') {
      window.RelayVoip?.setDeafen?.(Boolean(data.deafened));
      applyCallMediaMute(Boolean(data.deafened));
      syncCallControl({ deafened: Boolean(data.deafened) });
      updateCallChrome();
    }
  }

  async function restoreLastRoomIfNeeded() {
    if (didRestoreLastRoom || activeRoomId || createChatOpen || messageSearchOpen) return;
    didRestoreLastRoom = true;
    const lastId = localStorage.getItem('relay.lastRoomId');
    if (!lastId) {
      if (activeSpaceFilter === 'dms') void openFirstRoomInCatalog();
      return;
    }

    let room = roomCatalog.find((entry) => entry.roomId === lastId);
    if (!room) {
      try {
        room = await api(`/api/rooms/${encodeURIComponent(lastId)}`);
      } catch {
        localStorage.removeItem('relay.lastRoomId');
        return;
      }
      const preferredSpace =
        localStorage.getItem('relay.lastRoomSpace') ||
        (room.isDirect ? 'dms' : 'home');
      const nextSpace = room.isDirect
        ? 'dms'
        : preferredSpace === 'dms'
          ? 'home'
          : preferredSpace;
      if (nextSpace !== activeSpaceFilter) {
        activeSpaceFilter = nextSpace;
        localStorage.setItem('relay.space', nextSpace);
        syncWorkspaceRailSelection();
        syncDmRailChrome();
        await refreshRooms();
        room = roomCatalog.find((entry) => entry.roomId === lastId) || room;
      }
    }

    activeRoomId = lastId;
    syncControlRoom(lastId);
    updateTimelineHead(room || { roomId: lastId, name: room?.name || lastId });
    composerForm.hidden = false;
    stickMessagesToBottom = true;
    messageScrollRoomId = null;
    lastMessagesFingerprint = '';
    lastMessagesContentFingerprint = '';
    updateCallChrome();
    setMembersPanelOpen(membersPanelOpen);
    if (sharedMediaOpen) void refreshSharedMedia(lastId);
    // Hydrate recent history so messages from other clients while offline appear.
    await refreshMessages(lastId, {
      pinBottom: true,
      history: true,
      limit: 120,
      minMessages: 100,
    });
    void refreshTypingIndicator();
    void refreshRooms();
  }

  async function openRoomFromNotification(roomId) {
    if (!roomId) return;
    clearRoomNotifications(roomId);
    if (settingsOpen) closeSettings();
    hideAccountMenu();
    hideSpaceMenu();
    hideRoomMenu();
    hideMessageMenu();

    let room = roomCatalog.find((entry) => entry.roomId === roomId);
    if (!room) {
      try {
        room = await api(`/api/rooms/${encodeURIComponent(roomId)}`);
      } catch {
        room = null;
      }
    }

    if (room?.isDirect && activeSpaceFilter !== 'dms') setSpaceFilter('dms');
    else if (room && !room.isDirect && activeSpaceFilter === 'dms') setSpaceFilter('home');

    activeRoomId = roomId;
    persistLastRoom(roomId);
    syncControlRoom(roomId);
    updateTimelineHead(room || { roomId, name: roomId });
    composerForm.hidden = false;
    stickMessagesToBottom = true;
    messageScrollRoomId = null;
    lastMessagesFingerprint = '';
    lastMessagesContentFingerprint = '';
    updateCallChrome();
    setMembersPanelOpen(membersPanelOpen);
    await refreshRooms();
    await refreshMessages(roomId, {
      pinBottom: true,
      history: true,
      limit: 120,
      minMessages: 100,
    });
  }

  function getSpaceOrder() {
    return readJsonArray('relay.spaceOrder');
  }

  function setSpaceOrder(ids) {
    writeJsonArray('relay.spaceOrder', ids);
    scheduleSidebarLayoutSave();
  }

  function getSpaceFolders() {
    try {
      const raw = JSON.parse(localStorage.getItem('relay.spaceFolders') || '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((folder) => folder && typeof folder.id === 'string')
        .map((folder) => ({
          id: folder.id,
          name: String(folder.name || 'Folder'),
          collapsed: Boolean(folder.collapsed),
          spaceIds: Array.isArray(folder.spaceIds)
            ? folder.spaceIds.filter((id) => typeof id === 'string')
            : [],
        }));
    } catch {
      return [];
    }
  }

  function setSpaceFolders(folders) {
    // Discord/Paarrot: a folder needs 2+ spaces; singles dissolve back into the rail.
    const cleaned = (Array.isArray(folders) ? folders : [])
      .map((folder) => ({
        ...folder,
        spaceIds: [...new Set((folder.spaceIds || []).filter(Boolean))],
      }))
      .filter((folder) => folder.spaceIds.length >= 2);
    localStorage.setItem('relay.spaceFolders', JSON.stringify(cleaned));
    scheduleSidebarLayoutSave();
  }

  function getHiddenSpaces() {
    return new Set(readJsonArray('relay.hiddenSpaces'));
  }

  function setHiddenSpaces(ids) {
    writeJsonArray('relay.hiddenSpaces', [...ids]);
    scheduleSidebarLayoutSave();
  }

  let sidebarLayoutSaveTimer = null;
  let sidebarLayoutLoaded = false;

  function scheduleSidebarLayoutSave() {
    if (!sidebarLayoutLoaded) return;
    clearTimeout(sidebarLayoutSaveTimer);
    sidebarLayoutSaveTimer = setTimeout(() => {
      void api('/api/sidebar', {
        method: 'PUT',
        body: JSON.stringify({
          spaceOrder: getSpaceOrder(),
          spaceFolders: getSpaceFolders(),
          hiddenSpaces: [...getHiddenSpaces()],
        }),
      }).catch(() => {
        // ignore while logged out / server restarting
      });
    }, 250);
  }

  async function loadSidebarLayout() {
    try {
      const data = await api('/api/sidebar');
      const hasServerOrder = Array.isArray(data.spaceOrder) && data.spaceOrder.length > 0;
      const hasServerFolders = Array.isArray(data.spaceFolders) && data.spaceFolders.length > 0;
      const hasServerHidden = Array.isArray(data.hiddenSpaces) && data.hiddenSpaces.length > 0;
      const localOrder = readJsonArray('relay.spaceOrder');
      const localHidden = readJsonArray('relay.hiddenSpaces');
      let localFolders = [];
      try {
        const raw = JSON.parse(localStorage.getItem('relay.spaceFolders') || '[]');
        localFolders = Array.isArray(raw) ? raw : [];
      } catch {
        localFolders = [];
      }

      // Prefer durable server copy; migrate localStorage on first run after this feature.
      if (hasServerOrder) writeJsonArray('relay.spaceOrder', data.spaceOrder);
      else if (localOrder.length) {
        // keep local, will push on schedule after loaded
      }

      if (hasServerFolders) {
        localStorage.setItem('relay.spaceFolders', JSON.stringify(data.spaceFolders));
      }

      if (hasServerHidden) writeJsonArray('relay.hiddenSpaces', data.hiddenSpaces);

      sidebarLayoutLoaded = true;

      if (
        (!hasServerOrder && localOrder.length) ||
        (!hasServerFolders && localFolders.length) ||
        (!hasServerHidden && localHidden.length)
      ) {
        scheduleSidebarLayoutSave();
      }
    } catch {
      sidebarLayoutLoaded = true;
    }
  }

  function findSpaceFolder(spaceId) {
    return getSpaceFolders().find((folder) => folder.spaceIds.includes(spaceId)) || null;
  }

  function findFolderById(folderId) {
    return getSpaceFolders().find((folder) => folder.id === folderId) || null;
  }

  function updateSpaceFolder(folderId, patch) {
    const folders = getSpaceFolders();
    const index = folders.findIndex((folder) => folder.id === folderId);
    if (index < 0) return null;
    folders[index] = { ...folders[index], ...patch };
    setSpaceFolders(folders);
    return folders[index];
  }

  function createSpaceFolder(spaceIds, name = 'Folder') {
    const ids = [...new Set((spaceIds || []).filter(Boolean))];
    if (ids.length < 2) return null;
    const folders = getSpaceFolders().map((folder) => ({
      ...folder,
      spaceIds: folder.spaceIds.filter((id) => !ids.includes(id)),
    }));
    const folder = {
      id: `folder-${Date.now().toString(36)}`,
      name: String(name || 'Folder').trim() || 'Folder',
      collapsed: false,
      spaceIds: ids,
    };
    folders.push(folder);
    setSpaceFolders(folders);

    // Keep folder members contiguous in space order, starting at the first member.
    const order = ensureOrderIncludes(spaceCatalog);
    const positions = ids
      .map((id) => order.indexOf(id))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b);
    const insertAt = positions[0] ?? order.length;
    const next = order.filter((id) => !ids.includes(id));
    next.splice(insertAt, 0, ...ids);
    setSpaceOrder(next);
    return folder;
  }

  function addSpaceToFolder(folderId, spaceId) {
    if (!folderId || !spaceId) return;
    const folders = getSpaceFolders().map((folder) => ({
      ...folder,
      spaceIds: folder.spaceIds.filter((id) => id !== spaceId),
    }));
    const target = folders.find((folder) => folder.id === folderId);
    if (!target) return;
    target.spaceIds.push(spaceId);
    setSpaceFolders(folders);

    const order = ensureOrderIncludes(spaceCatalog);
    const without = order.filter((id) => id !== spaceId);
    const anchor = target.spaceIds.find((id) => id !== spaceId && without.includes(id));
    const insertAt = anchor ? without.indexOf(anchor) + 1 : without.length;
    without.splice(insertAt, 0, spaceId);
    setSpaceOrder(without);
  }

  function removeSpaceFromFolder(spaceId) {
    if (!spaceId) return;
    const folders = getSpaceFolders().map((folder) => ({
      ...folder,
      spaceIds: folder.spaceIds.filter((id) => id !== spaceId),
    }));
    setSpaceFolders(folders);
  }

  function ungroupSpaceFolder(folderId) {
    setSpaceFolders(getSpaceFolders().filter((folder) => folder.id !== folderId));
  }

  /** Drop on a rail gap: reorder + join/leave folder (Discord-style between-icons line). */
  function placeSpaceAtGap(spaceId, { beforeId = null, folderId = null } = {}) {
    if (!spaceId) return;
    if (beforeId && spaceId === beforeId) return;

    if (folderId) {
      const target = findFolderById(folderId);
      if (target) {
        const memberIds = target.spaceIds.filter((id) => id !== spaceId);
        let at = beforeId ? memberIds.indexOf(beforeId) : -1;
        if (at < 0) at = memberIds.length;
        memberIds.splice(at, 0, spaceId);
        const folders = getSpaceFolders().map((folder) => {
          if (folder.id === folderId) return { ...folder, spaceIds: memberIds };
          return {
            ...folder,
            spaceIds: folder.spaceIds.filter((id) => id !== spaceId),
          };
        });
        setSpaceFolders(folders);
      } else {
        addSpaceToFolder(folderId, spaceId);
      }
    } else if (findSpaceFolder(spaceId)) {
      removeSpaceFromFolder(spaceId);
    }

    const order = ensureOrderIncludes(spaceCatalog);
    const next = order.filter((id) => id !== spaceId);
    let insertAt;
    if (beforeId && next.includes(beforeId)) {
      insertAt = next.indexOf(beforeId);
    } else if (folderId) {
      const folder = findFolderById(folderId);
      const anchor = folder?.spaceIds.filter((id) => id !== spaceId).at(-1);
      insertAt = anchor && next.includes(anchor) ? next.indexOf(anchor) + 1 : next.length;
    } else {
      insertAt = next.length;
    }
    next.splice(insertAt, 0, spaceId);
    setSpaceOrder(next);
  }

  function orderedVisibleSpaces(spaces) {
    const hidden = getHiddenSpaces();
    const visible = spaces.filter((space) => !hidden.has(space.spaceId));
    const order = getSpaceOrder();
    const rank = new Map(order.map((id, index) => [id, index]));
    return visible.sort((a, b) => {
      const ai = rank.has(a.spaceId) ? rank.get(a.spaceId) : Number.MAX_SAFE_INTEGER;
      const bi = rank.has(b.spaceId) ? rank.get(b.spaceId) : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name);
    });
  }

  function ensureOrderIncludes(spaces) {
    const current = getSpaceOrder();
    const ids = spaces.map((space) => space.spaceId);
    const next = [
      ...current.filter((id) => ids.includes(id)),
      ...ids.filter((id) => !current.includes(id)),
    ];
    if (JSON.stringify(next) !== JSON.stringify(current)) setSpaceOrder(next);
    return next;
  }

  function hideSpaceMenu() {
    spaceContextMenu.hidden = true;
    contextSpaceId = null;
  }

  function hideFolderMenu() {
    if (folderContextMenu) folderContextMenu.hidden = true;
    contextFolderId = null;
  }

  function hideRoomMenu() {
    roomContextMenu.hidden = true;
    contextRoomId = null;
    for (const btn of roomList.querySelectorAll('.room-more.is-open')) {
      btn.classList.remove('is-open');
    }
    roomMoreBtn?.classList.remove('is-active', 'is-open');
    roomMoreBtn?.setAttribute('aria-expanded', 'false');
  }


  let pendingForwardMessage = null;
  let draftSaveTimer = 0;
  let autocompleteState = { items: [], index: 0, start: 0, end: 0, kind: null };
  let roomSettingsRoomId = null;

  function spellcheckEnabled() {
    return readBoolPref('relay.spellcheck', true);
  }

  function applySpellcheckPref() {
    const on = spellcheckEnabled();
    if (prefSpellcheck) prefSpellcheck.checked = on;
    if (composerInput) {
      composerInput.spellcheck = on;
      composerInput.setAttribute('spellcheck', on ? 'true' : 'false');
      // Chromium sometimes only re-evaluates after a focus pass.
      if (document.activeElement === composerInput) {
        composerInput.blur();
        queueMicrotask(() => composerInput.focus());
      }
    }
    if (window.relayDesktop?.setSpellcheck) {
      void window.relayDesktop.setSpellcheck(on).catch(() => {});
    }
  }

  function readDraftMap() {
    try {
      const raw = localStorage.getItem('relay.drafts');
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeDraftMap(map) {
    localStorage.setItem('relay.drafts', JSON.stringify(map || {}));
  }

  function saveComposerDraft(roomId) {
    const id = String(roomId || '').trim();
    if (!id || !composerInput) return;
    const body = String(composerInput.value || '');
    const map = readDraftMap();
    if (!body.trim() && (!pendingMentions || !pendingMentions.length)) {
      delete map[id];
    } else {
      map[id] = {
        body,
        mentions: Array.isArray(pendingMentions) ? pendingMentions.map((m) => ({ ...m })) : [],
      };
    }
    writeDraftMap(map);
  }

  function restoreComposerDraft(roomId) {
    const id = String(roomId || '').trim();
    if (!id || !composerInput) return;
    const entry = readDraftMap()[id];
    composerInput.value = entry?.body || '';
    clearMentions();
    if (Array.isArray(entry?.mentions)) {
      for (const mention of entry.mentions) {
        if (mention?.userId) addMention(mention);
      }
    }
    autosizeComposer();
  }

  function clearComposerDraft(roomId) {
    const id = String(roomId || '').trim();
    if (!id) return;
    const map = readDraftMap();
    if (!(id in map)) return;
    delete map[id];
    writeDraftMap(map);
  }

  function scheduleDraftSave() {
    if (!activeRoomId) return;
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = window.setTimeout(() => {
      draftSaveTimer = 0;
      saveComposerDraft(activeRoomId);
    }, 250);
  }

  function readRoomNotifLevels() {
    try {
      const raw = localStorage.getItem('relay.roomNotifLevels');
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeRoomNotifLevels(map) {
    localStorage.setItem('relay.roomNotifLevels', JSON.stringify(map || {}));
  }

  function getRoomNotifLevel(roomId) {
    const id = String(roomId || '');
    const stored = readRoomNotifLevels()[id];
    if (stored === 'all' || stored === 'mentions' || stored === 'mute') return stored;
    if (getMutedRooms().has(id)) return 'mute';
    return 'all';
  }

  async function setRoomNotifLevel(roomId, level) {
    const id = String(roomId || '').trim();
    const mode = String(level || 'all').toLowerCase();
    if (!id || !['all', 'mentions', 'mute'].includes(mode)) return;
    const map = readRoomNotifLevels();
    map[id] = mode;
    writeRoomNotifLevels(map);
    const muted = getMutedRooms();
    if (mode === 'mute') muted.add(id);
    else muted.delete(id);
    setMutedRooms(muted);
    try {
      await api(`/api/rooms/${encodeURIComponent(id)}/notifications`, {
        method: 'POST',
        body: JSON.stringify({ level: mode }),
      });
    } catch {
      // local level still applies for desktop alerts
    }
  }

  function hideComposerAutocomplete() {
    autocompleteState = { items: [], index: 0, start: 0, end: 0, kind: null };
    if (composerAutocomplete) {
      composerAutocomplete.hidden = true;
      composerAutocomplete.innerHTML = '';
    }
  }

  function getComposerTokenAtCaret() {
    if (!composerInput) return null;
    const value = composerInput.value || '';
    const caret = composerInput.selectionStart || 0;
    const before = value.slice(0, caret);
    const match = /(^|[\s([{])([@#:])([^\s]*)$/.exec(before);
    if (!match) return null;
    return {
      kind: match[2],
      query: match[3] || '',
      start: caret - (match[3] || '').length - 1,
      end: caret,
    };
  }

  function renderComposerAutocomplete() {
    if (!composerAutocomplete) return;
    const { items, index } = autocompleteState;
    if (!items.length) {
      hideComposerAutocomplete();
      return;
    }
    composerAutocomplete.innerHTML = '';
    items.forEach((item, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `composer-autocomplete-item${i === index ? ' is-active' : ''}`;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', i === index ? 'true' : 'false');
      const lead = document.createElement('span');
      lead.className = 'composer-autocomplete-lead';
      lead.textContent = item.lead || '';
      const label = document.createElement('span');
      label.className = 'composer-autocomplete-label';
      label.textContent = item.label || '';
      btn.appendChild(lead);
      btn.appendChild(label);
      btn.addEventListener('mousedown', (event) => {
        event.preventDefault();
        applyComposerAutocomplete(i);
      });
      composerAutocomplete.appendChild(btn);
    });
    composerAutocomplete.hidden = false;
  }

  function buildComposerAutocompleteItems(token) {
    const q = String(token.query || '').toLowerCase();
    if (token.kind === '@') {
      return roomMembersCache
        .filter((m) => {
          const name = String(m.displayName || m.userId || '').toLowerCase();
          const id = String(m.userId || '').toLowerCase();
          return !q || name.includes(q) || id.includes(q);
        })
        .slice(0, 8)
        .map((m) => ({
          kind: 'mention',
          lead: '@',
          label: m.displayName || m.userId,
          value: m,
        }));
    }
    if (token.kind === '#') {
      return roomCatalog
        .filter((r) => {
          const name = String(r.name || '').toLowerCase();
          const alias = String(r.canonicalAlias || r.alias || '').toLowerCase();
          return !q || name.includes(q) || alias.includes(q) || String(r.roomId || '').toLowerCase().includes(q);
        })
        .slice(0, 8)
        .map((r) => ({
          kind: 'room',
          lead: '#',
          label: r.name || r.canonicalAlias || r.roomId,
          value: r,
        }));
    }
    if (token.kind === ':') {
      const entries = Object.entries(EMOJI_SHORTCODES || {})
        .filter(([emoji, code]) => {
          const c = String(code || '').toLowerCase();
          return !q || c.includes(q) || String(emoji).includes(q);
        })
        .slice(0, 8);
      // EMOJI_SHORTCODES maps emoji->code; also support reverse from common codes via Object
      const fromCodes = [];
      for (const [emoji, code] of Object.entries(EMOJI_SHORTCODES || {})) {
        const c = String(code || '').replace(/^:|:$/g, '').toLowerCase();
        if (q && !c.includes(q) && !String(emoji).includes(q)) continue;
        fromCodes.push({
          kind: 'emoji',
          lead: emoji,
          label: `:${c}:`,
          value: emoji,
        });
        if (fromCodes.length >= 8) break;
      }
      return fromCodes.length ? fromCodes : entries.map(([emoji, code]) => ({
        kind: 'emoji',
        lead: emoji,
        label: String(code),
        value: emoji,
      }));
    }
    return [];
  }

  function updateComposerAutocomplete() {
    const token = getComposerTokenAtCaret();
    if (!token) {
      hideComposerAutocomplete();
      return;
    }
    const items = buildComposerAutocompleteItems(token);
    if (!items.length) {
      hideComposerAutocomplete();
      return;
    }
    autocompleteState = {
      items,
      index: 0,
      start: token.start,
      end: token.end,
      kind: token.kind,
    };
    renderComposerAutocomplete();
  }

  function applyComposerAutocomplete(index = autocompleteState.index) {
    const item = autocompleteState.items[index];
    if (!item || !composerInput) return;
    const value = composerInput.value || '';
    const before = value.slice(0, autocompleteState.start);
    const after = value.slice(autocompleteState.end);
    if (item.kind === 'mention') {
      composerInput.value = `${before}${after}`;
      const caret = before.length;
      composerInput.setSelectionRange(caret, caret);
      addMention({
        userId: item.value.userId,
        displayName: item.value.displayName || item.value.userId,
      });
    } else if (item.kind === 'room') {
      const insert = item.value.canonicalAlias || item.value.alias || item.value.name || item.value.roomId;
      composerInput.value = `${before}${insert} ${after}`;
      const caret = before.length + String(insert).length + 1;
      composerInput.setSelectionRange(caret, caret);
    } else if (item.kind === 'emoji') {
      composerInput.value = `${before}${item.value} ${after}`;
      const caret = before.length + String(item.value).length + 1;
      composerInput.setSelectionRange(caret, caret);
    }
    hideComposerAutocomplete();
    composerInput.focus();
    autosizeComposer();
    scheduleDraftSave();
  }

  function openReactionDetails(reaction) {
    if (!reactionDetailsDialog || !reactionDetailsList) return;
    const key = reaction?.key || 'Reactions';
    if (reactionDetailsTitle) reactionDetailsTitle.textContent = key;
    reactionDetailsList.innerHTML = '';
    const senders = Array.isArray(reaction?.senders) ? reaction.senders : [];
    if (!senders.length) {
      const empty = document.createElement('li');
      empty.className = 'message-receipts-empty';
      empty.textContent = 'No reactors yet.';
      reactionDetailsList.appendChild(empty);
    } else {
      for (const entry of senders) {
        const li = document.createElement('li');
        li.className = 'message-receipts-row';
        const fallback = document.createElement('span');
        fallback.className = 'message-receipts-avatar-fallback';
        const name = entry.displayName || entry.userId || 'Unknown';
        fallback.textContent = initials(name);
        li.appendChild(fallback);
        const label = document.createElement('span');
        label.className = 'message-receipts-name';
        label.textContent = name;
        li.appendChild(label);
        reactionDetailsList.appendChild(li);
      }
    }
    if (typeof reactionDetailsDialog.showModal === 'function') reactionDetailsDialog.showModal();
  }

  function openForwardDialog(msg) {
    pendingForwardMessage = msg;
    if (forwardMessageError) {
      forwardMessageError.hidden = true;
      forwardMessageError.textContent = '';
    }
    if (forwardMessageSearch) forwardMessageSearch.value = '';
    renderForwardRoomList('');
    if (typeof forwardMessageDialog?.showModal === 'function') forwardMessageDialog.showModal();
    queueMicrotask(() => forwardMessageSearch?.focus());
  }

  function renderForwardRoomList(query) {
    if (!forwardMessageList) return;
    forwardMessageList.innerHTML = '';
    const q = String(query || '').toLowerCase().trim();
    const rooms = roomCatalog
      .filter((r) => r?.roomId && r.roomId !== pendingForwardMessage?.roomId)
      .filter((r) => {
        if (!q) return true;
        return (
          String(r.name || '').toLowerCase().includes(q) ||
          String(r.canonicalAlias || '').toLowerCase().includes(q) ||
          String(r.roomId || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 40);
    if (!rooms.length) {
      const empty = document.createElement('li');
      empty.textContent = 'No rooms found';
      forwardMessageList.appendChild(empty);
      return;
    }
    for (const room of rooms) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'forward-message-item';
      btn.textContent = room.name || room.canonicalAlias || room.roomId;
      btn.addEventListener('click', () => {
        void forwardToRoom(room.roomId);
      });
      li.appendChild(btn);
      forwardMessageList.appendChild(li);
    }
  }

  async function forwardToRoom(targetRoomId) {
    if (!pendingForwardMessage?.eventId || !pendingForwardMessage?.roomId) return;
    try {
      await api(
        `/api/rooms/${encodeURIComponent(pendingForwardMessage.roomId)}/messages/${encodeURIComponent(pendingForwardMessage.eventId)}/forward`,
        {
          method: 'POST',
          body: JSON.stringify({ targetRoomId }),
        },
      );
      forwardMessageDialog?.close?.();
      pendingForwardMessage = null;
      const target = roomCatalog.find((r) => r.roomId === targetRoomId);
      if (target) openRoomEntry(target);
    } catch (error) {
      if (forwardMessageError) {
        forwardMessageError.hidden = false;
        forwardMessageError.textContent = (error.message || String(error)).replace(/^MatrixError:\s*/i, '');
      }
    }
  }

  async function openSasVerifyDialog(deviceId) {
    if (!sasVerifyDialog || !sasVerifyEmojis) return;
    if (sasVerifyError) {
      sasVerifyError.hidden = true;
      sasVerifyError.textContent = '';
    }
    sasVerifyEmojis.innerHTML = '<p class="settings-muted">Starting verification…</p>';
    if (typeof sasVerifyDialog.showModal === 'function') sasVerifyDialog.showModal();
    try {
      const result = await api(`/api/devices/${encodeURIComponent(deviceId)}/verify-sas`, {
        method: 'POST',
        body: '{}',
      });
      if (result.mode === 'cross-sign') {
        sasVerifyDialog.close();
        window.alert('Device cross-signed.');
        void refreshDevicesSettings();
        return;
      }
      sasVerifyEmojis.innerHTML = '';
      for (const entry of result.sas?.emojis || []) {
        const chip = document.createElement('div');
        chip.className = 'sas-verify-chip';
        const emoji = document.createElement('span');
        emoji.className = 'sas-verify-emoji';
        emoji.textContent = entry.emoji || '';
        const label = document.createElement('span');
        label.className = 'sas-verify-label';
        label.textContent = entry.label || '';
        chip.appendChild(emoji);
        chip.appendChild(label);
        sasVerifyEmojis.appendChild(chip);
      }
      if (!result.sas?.emojis?.length) {
        sasVerifyEmojis.innerHTML = '<p class="settings-muted">Waiting for emoji SAS from the other device…</p>';
      }
    } catch (error) {
      if (sasVerifyError) {
        sasVerifyError.hidden = false;
        sasVerifyError.textContent = (error.message || String(error)).replace(/^MatrixError:\s*/i, '');
      }
    }
  }

  async function confirmSas(match) {
    try {
      await api('/api/devices/verify-sas/confirm', {
        method: 'POST',
        body: JSON.stringify({ match: Boolean(match) }),
      });
      sasVerifyDialog?.close?.();
      void refreshDevicesSettings();
      window.alert(match ? 'Devices verified.' : 'Verification cancelled.');
    } catch (error) {
      if (sasVerifyError) {
        sasVerifyError.hidden = false;
        sasVerifyError.textContent = (error.message || String(error)).replace(/^MatrixError:\s*/i, '');
      }
    }
  }

    function openMessageReceiptsDialog(msg) {
    if (!messageReceiptsDialog || !messageReceiptsList || !msg) return;
    messageReceiptsList.innerHTML = '';
    const readers = Array.isArray(msg.readBy) ? msg.readBy : [];
    if (!readers.length) {
      const empty = document.createElement('li');
      empty.className = 'message-receipts-empty';
      empty.textContent = 'No one has seen this yet.';
      messageReceiptsList.appendChild(empty);
    } else {
      for (const entry of readers) {
        const li = document.createElement('li');
        li.className = 'message-receipts-row';

        const avatarUrl = entry.avatarUrl || (entry.userId ? avatarUrlForUser(entry.userId) : null);
        const name = entry.displayName || entry.userId || 'Unknown';
        if (entry.hasAvatar !== false && avatarUrl) {
          const img = document.createElement('img');
          img.className = 'message-receipts-avatar';
          img.alt = '';
          img.referrerPolicy = 'no-referrer';
          img.src = avatarUrl;
          img.addEventListener(
            'error',
            () => {
              const fallback = document.createElement('span');
              fallback.className = 'message-receipts-avatar-fallback';
              fallback.textContent = initials(name);
              img.replaceWith(fallback);
            },
            { once: true },
          );
          li.appendChild(img);
        } else {
          const fallback = document.createElement('span');
          fallback.className = 'message-receipts-avatar-fallback';
          fallback.textContent = initials(name);
          li.appendChild(fallback);
        }

        const label = document.createElement('span');
        label.className = 'message-receipts-name';
        label.textContent = name;
        li.appendChild(label);
        messageReceiptsList.appendChild(li);
      }
    }
    if (typeof messageReceiptsDialog.showModal === 'function') messageReceiptsDialog.showModal();
  }

  function latestMineMessageEventId(messages) {
    for (let i = (messages || []).length - 1; i >= 0; i -= 1) {
      const candidate = messages[i];
      if (!candidate?.isMine || candidate.redacted) continue;
      if (candidate.systemKind) continue;
      if (candidate.type !== 'm.room.message' && !candidate.encrypted) continue;
      return candidate.eventId || null;
    }
    return null;
  }

  function receiptDisplayNames(readBy) {
    return (readBy || [])
      .map((entry) => {
        const name = entry.displayName || entry.userId || '';
        if (name.startsWith('@')) {
          const local = name.slice(1).split(':')[0];
          return local || name;
        }
        return name;
      })
      .filter(Boolean);
  }

  function buildMessageReceiptsButton(msg) {
    const names = receiptDisplayNames(msg.readBy);
    if (!names.length) return null;
    const receipts = document.createElement('button');
    receipts.type = 'button';
    receipts.className = 'message-receipts';
    receipts.title = 'Seen by';
    receipts.setAttribute('aria-label', `Seen by ${names.join(', ')}`);
    const mark = document.createElement('span');
    mark.className = 'message-receipt-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '✓✓';
    receipts.appendChild(mark);
    const label = document.createElement('span');
    label.className = 'message-receipt-names';
    const shown = names.slice(0, 3);
    label.textContent =
      names.length > shown.length
        ? `${shown.join(', ')} +${names.length - shown.length}`
        : shown.join(', ');
    receipts.appendChild(label);
    receipts.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openMessageReceiptsDialog(msg);
    });
    return receipts;
  }

  function syncMessageReceiptsUi(messages) {
    if (!messageList) return;
    messageList.querySelectorAll('.message-receipts').forEach((el) => el.remove());
    const latestId = latestMineMessageEventId(messages);
    if (!latestId) return;
    const msg = (messages || []).find((entry) => entry.eventId === latestId);
    if (!msg || !Array.isArray(msg.readBy) || !msg.readBy.length) return;
    const row = messageList.querySelector(`[data-event-id="${CSS.escape(latestId)}"]`);
    const main = row?.querySelector?.('.message-main');
    const button = buildMessageReceiptsButton(msg);
    if (main && button) main.appendChild(button);
  }

  function hideMessageMenu() {
    if (messageContextMenu) messageContextMenu.hidden = true;
    contextMessage = null;
    if (!messageList) return;
    for (const btn of messageList.querySelectorAll('.message-more.is-open, .message-toolbar-btn.is-open')) {
      btn.classList.remove('is-open');
    }
    for (const bar of messageList.querySelectorAll('.message-toolbar.is-open')) {
      bar.classList.remove('is-open');
    }
  }

  function getRecentReactions() {
    const stored = readJsonArray('relay.recentReactions');
    const merged = [...stored, ...DEFAULT_QUICK_REACTIONS].filter(Boolean);
    return [...new Set(merged)].slice(0, 6);
  }

  function rememberRecentReaction(key) {
    const emoji = String(key || '').trim();
    if (!emoji) return;
    const next = [emoji, ...getRecentReactions().filter((entry) => entry !== emoji)].slice(0, 12);
    try {
      localStorage.setItem('relay.recentReactions', JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function renderComposerReplyBar() {
    if (!composerReplyBar) return;
    if (!pendingReply?.eventId || pendingEdit) {
      composerReplyBar.hidden = true;
      if (composerReplyLabel) composerReplyLabel.textContent = 'Replying';
      if (composerReplyPreview) composerReplyPreview.textContent = '';
      return;
    }
    composerReplyBar.hidden = false;
    if (composerReplyLabel) {
      composerReplyLabel.textContent = pendingReply.thread
        ? `Thread reply to ${pendingReply.senderName || pendingReply.sender || 'message'}`
        : `Replying to ${pendingReply.senderName || pendingReply.sender || 'message'}`;
    }
    if (composerReplyPreview) {
      composerReplyPreview.textContent = pendingReply.body || 'Message';
    }
  }

  function renderComposerEditBar() {
    if (!composerEditBar) return;
    if (!pendingEdit?.eventId) {
      composerEditBar.hidden = true;
      if (composerEditPreview) composerEditPreview.textContent = '';
      return;
    }
    composerEditBar.hidden = false;
    if (composerEditPreview) {
      composerEditPreview.textContent = pendingEdit.body || 'Message';
    }
  }

  function clearPendingReply() {
    pendingReply = null;
    renderComposerReplyBar();
  }

  function clearPendingEdit() {
    pendingEdit = null;
    renderComposerEditBar();
  }

  function setPendingReply(msg, { thread = false } = {}) {
    if (!msg?.eventId) return;
    clearPendingEdit();
    pendingReply = {
      eventId: msg.eventId,
      sender: msg.sender || null,
      senderName: msg.senderName || msg.sender || null,
      body: typeof msg.body === 'string' ? msg.body.slice(0, 160) : null,
      thread: Boolean(thread),
    };
    renderComposerReplyBar();
    composerInput?.focus();
  }

  function setPendingEdit(msg) {
    if (!msg?.eventId) return;
    clearPendingReply();
    pendingEdit = {
      eventId: msg.eventId,
      body: typeof msg.body === 'string' ? msg.body : null,
    };
    if (composerInput) {
      composerInput.value = typeof msg.body === 'string' ? msg.body : '';
      autosizeComposer();
    }
    renderComposerEditBar();
    composerInput?.focus();
  }

  async function toggleMessageReaction(roomId, eventId, key) {
    if (!roomId || !eventId || !key) return;
    rememberRecentReaction(key);
    await api(`/api/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(eventId)}/react`, {
      method: 'POST',
      body: JSON.stringify({ key }),
    });
    if (activeRoomId === roomId) {
      lastMessagesFingerprint = '';
      lastMessagesContentFingerprint = '';
      await refreshMessages(roomId, { quiet: true });
    }
    if (forumThread?.roomId === roomId && forumOpen) {
      await loadForumThread(roomId, forumThread.eventId, { quiet: true });
    }
  }

  function openReactionPicker(roomId, eventId) {
    pendingReactionTarget = { roomId, eventId };
    openPicker('emoji');
  }

  function renderQuickReactionRow() {
    if (!messageReactRow) return;
    messageReactRow.innerHTML = '';
    for (const emoji of getRecentReactions()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'message-react-chip';
      btn.dataset.messageReact = emoji;
      btn.title = `React ${emoji}`;
      btn.textContent = emoji;
      messageReactRow.appendChild(btn);
    }
  }

  function buildMessageToolbar(msg) {
    const bar = document.createElement('div');
    bar.className = 'message-toolbar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Message actions');

    const addBtn = (action, title, svgPaths, { hidden = false } = {}) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `message-toolbar-btn${hidden ? ' is-hidden' : ''}`;
      btn.dataset.messageToolbar = action;
      btn.title = title;
      btn.setAttribute('aria-label', title);
      btn.innerHTML = `<svg class="ui-icon ui-icon--stroke" viewBox="0 0 24 24" aria-hidden="true">${svgPaths}</svg>`;
      bar.appendChild(btn);
      return btn;
    };

    addBtn(
      'react',
      'Add Reaction',
      '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.8 2.2 3.5 2.2 3.5-2.2 3.5-2.2"/><circle cx="9" cy="10" r="1" class="ui-icon--fill"/><circle cx="15" cy="10" r="1" class="ui-icon--fill"/>',
    );
    addBtn('reply', 'Reply', '<path d="M9 14H4V9"/><path d="M20 18a8 8 0 0 0-8-8H4"/>');
    addBtn(
      'reply-thread',
      'Reply in Thread',
      '<path d="M21 15a2 2 0 0 1-2 2H8l-4 3V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/><path d="M12 8v5M9.5 10.5h5"/>',
    );
    addBtn(
      'edit',
      'Edit Message',
      '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
      { hidden: !(msg.canEdit || msg.isMine) || !(typeof msg.body === 'string' && msg.body.trim()) },
    );
    addBtn(
      'copy',
      'Copy Raw Text',
      '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
      { hidden: !(typeof msg.body === 'string' && msg.body.trim()) },
    );
    // Paarrot: delete appears on toolbar while Shift is held
    const deleteBtn = addBtn(
      'delete',
      'Delete Message (Shift held)',
      '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
      { hidden: !msg.canRedact },
    );
    deleteBtn.classList.add('message-toolbar-btn--danger', 'message-toolbar-btn--shift-only');
    const more = addBtn('more', 'More', '<circle cx="6" cy="12" r="1.3" class="ui-icon--fill"/><circle cx="12" cy="12" r="1.3" class="ui-icon--fill"/><circle cx="18" cy="12" r="1.3" class="ui-icon--fill"/>');

    bar.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-message-toolbar]');
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      const action = btn.dataset.messageToolbar;
      if (action === 'react') {
        openReactionPicker(activeRoomId, msg.eventId);
      } else if (action === 'reply') {
        setPendingReply(msg, { thread: false });
      } else if (action === 'reply-thread') {
        setPendingReply(msg, { thread: true });
      } else if (action === 'edit') {
        setPendingEdit(msg);
      } else if (action === 'copy') {
        if (msg.body) void navigator.clipboard.writeText(msg.body);
      } else if (action === 'delete') {
        if (!msg.canRedact || !activeRoomId || !msg.eventId) return;
        if (!window.confirm('Delete this message for everyone?')) return;
        const eventId = msg.eventId;
        const roomId = activeRoomId;
        applyOptimisticRedaction(eventId);
        void api(
          `/api/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(eventId)}/redact`,
          { method: 'POST', body: '{}' },
        )
          .then(() => refreshMessages(roomId, { quiet: true }))
          .catch((error) => {
            window.alert((error.message || String(error)).replace(/^MatrixError:\s*/i, ''));
            lastMessagesFingerprint = '';
            lastMessagesContentFingerprint = '';
            void refreshMessages(roomId, { quiet: true });
          });
      } else if (action === 'more') {
        const rect = more.getBoundingClientRect();
        showMessageMenu(msg, rect.right - 8, rect.bottom + 4, more);
        bar.classList.add('is-open');
      }
    });

    return bar;
  }

  function buildReactionRow(reactions, { roomId, eventId, className = 'message-reactions' } = {}) {
    const list = Array.isArray(reactions) ? reactions : [];
    if (!list.length) return null;
    const row = document.createElement('div');
    row.className = className;
    for (const reaction of list) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `message-reaction${reaction.me ? ' is-mine' : ''}`;
      btn.title = reaction.me
        ? 'Remove reaction · right-click who reacted'
        : 'Add reaction · right-click who reacted';

      const emoji = document.createElement('span');
      emoji.className = 'message-reaction-emoji';
      emoji.textContent = reaction.key;
      const count = document.createElement('span');
      count.className = 'message-reaction-count';
      count.textContent = String(reaction.count);
      btn.appendChild(emoji);
      btn.appendChild(count);

      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.altKey || event.shiftKey) {
          openReactionDetails(reaction);
          return;
        }
        void toggleMessageReaction(roomId, eventId, reaction.key).catch((error) => {
          window.alert((error.message || String(error)).replace(/^MatrixError:\s*/i, ''));
        });
      });
      btn.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openReactionDetails(reaction);
      });
      row.appendChild(btn);
    }
    return row;
  }

  function showMessageMenu(msg, clientX, clientY, anchorBtn = null) {
    if (!messageContextMenu || !msg?.eventId || !activeRoomId) return;
    hideSpaceMenu();
    hideRoomMenu();
    hideUserProfile();
    contextMessage = {
      roomId: activeRoomId,
      eventId: msg.eventId,
      body: typeof msg.body === 'string' ? msg.body : null,
      canRedact: Boolean(msg.canRedact),
      canEdit: Boolean(msg.canEdit || msg.isMine),
      canPin: msg.canPin !== false,
      isPinned: Boolean(msg.isPinned),
      isMine: Boolean(msg.isMine),
      sender: msg.sender || null,
      senderName: msg.senderName || msg.sender || null,
      readBy: Array.isArray(msg.readBy) ? msg.readBy : [],
      source: msg.source || null,
    };

    renderQuickReactionRow();

    const copyBtn = messageContextMenu.querySelector('[data-message-action="copy"]');
    const editBtn = messageContextMenu.querySelector('[data-message-action="edit"]');
    const pinBtn = messageContextMenu.querySelector('[data-message-action="pin"]');
    const deleteBtn = messageContextMenu.querySelector('[data-message-action="delete"]');
    const deleteSep = messageContextMenu.querySelector('[data-message-sep="delete"]');
    const hasText = Boolean(contextMessage.body && contextMessage.body.trim());
    if (copyBtn) {
      copyBtn.disabled = !hasText;
      copyBtn.classList.toggle('is-disabled', !hasText);
    }
    if (editBtn) editBtn.hidden = !contextMessage.canEdit || !hasText;
    if (pinBtn) {
      pinBtn.hidden = !contextMessage.canPin;
      if (messagePinLabel) {
        messagePinLabel.textContent = contextMessage.isPinned ? 'Unpin Message' : 'Pin Message';
      }
    }
    if (deleteBtn) deleteBtn.hidden = !contextMessage.canRedact;
    if (deleteSep) deleteSep.hidden = !contextMessage.canRedact;

    if (anchorBtn) anchorBtn.classList.add('is-open');
    messageContextMenu.hidden = false;
    const rect = messageContextMenu.getBoundingClientRect();
    const x = Math.min(clientX, window.innerWidth - rect.width - 8);
    const y = Math.min(clientY, window.innerHeight - rect.height - 8);
    messageContextMenu.style.left = `${Math.max(8, x)}px`;
    messageContextMenu.style.top = `${Math.max(8, y)}px`;
  }

  function hideUserProfile() {
    userProfileCard.hidden = true;
    profileUser = null;
  }

  function bannerStyleForUser(userId) {
    let hash = 0;
    for (const ch of String(userId || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = hash % 360;
    return `
      repeating-linear-gradient(-35deg, rgba(0,0,0,0.55) 0 2px, rgba(255,255,255,0.06) 2px 4px),
      linear-gradient(135deg, hsl(${hue} 35% 18%), hsl(${(hue + 40) % 360} 30% 10%) 55%, hsl(${(hue + 80) % 360} 25% 14%))
    `;
  }

  function nameColorForUser(userId) {
    let hash = 0;
    for (const ch of String(userId || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = hash % 360;
    return `hsl(${hue} 72% 72%)`;
  }

  const NAMEPLATES = {
    panda: {
      id: 'panda',
      src: '/nameplates/panda.png',
      wash: 'linear-gradient(90deg, #3a1a5ecc 0%, #8A4DBF55 42%, transparent 78%)',
    },
  };

  /** @type {Map<string, object|null>} */
  const senderStyleCache = new Map();
  let selectedNameplate = '';
  let messageRefreshToken = 0;
  /** Room id while an authoritative history load is in flight — quiet polls must not cancel it. */
  let historyLoadingRoomId = null;
  let lastMessagesFingerprint = '';
  let lastMessagesContentFingerprint = '';
  let activeRoomMessages = [];
  let timelineAtStart = true;
  let loadingOlderMessages = false;
  /** @type {EventSource | null} */
  let liveEventSource = null;
  let liveMessageRefreshTimer = 0;
  let liveRoomsRefreshTimer = 0;
  let liveReceiptRefreshTimer = 0;
  let liveStreamConnected = false;
  let liveMessageRefreshRoomId = null;

  function rememberSenderStyle(userId, style) {
    if (!userId) return;
    senderStyleCache.set(userId, style || null);
  }

  function clearUsernameStyle(el) {
    if (!el) return;
    el.classList.remove('sender--gradient');
    el.style.removeProperty('background-image');
    el.style.removeProperty('-webkit-text-fill-color');
    el.style.removeProperty('color');
    el.style.removeProperty('background-clip');
    el.style.removeProperty('-webkit-background-clip');
  }

  function applyNameplateToWrap(wrap, nameplateId) {
    if (!wrap) return;
    const asset = wrap.querySelector('.sender-nameplate-asset');
    const plate = NAMEPLATES[nameplateId];
    wrap.classList.toggle('has-nameplate', Boolean(plate));
    wrap.dataset.nameplate = plate ? plate.id : '';
    if (asset) {
      if (plate) {
        asset.style.backgroundImage = `${plate.wash}, url('${plate.src}')`;
      } else {
        asset.style.backgroundImage = '';
      }
    }
  }

  function applyUsernameStyle(senderEl, style, { fallbackColor = '' } = {}) {
    if (!senderEl) return;
    const wrap = senderEl.closest('.sender-nameplate');
    const nameplateId = style?.nameplate || '';
    applyNameplateToWrap(wrap, nameplateId);

    clearUsernameStyle(senderEl);

    // Paarrot: solid accent from avatar tEXt `paarrot:color`
    if (style?.color) {
      senderEl.style.color = style.color;
      return;
    }

    const start = style?.nameGradientStart;
    const end = style?.nameGradientEnd;
    if (start && end) {
      senderEl.classList.add('sender--gradient');
      senderEl.style.backgroundImage = `linear-gradient(90deg, ${start}, ${end})`;
      senderEl.style.webkitBackgroundClip = 'text';
      senderEl.style.backgroundClip = 'text';
      senderEl.style.webkitTextFillColor = 'transparent';
      senderEl.style.color = 'transparent';
      return;
    }
    if (start) {
      senderEl.style.color = start;
      return;
    }
    if (fallbackColor) senderEl.style.color = fallbackColor;
  }

  function setNameplateSelection(id) {
    selectedNameplate = id || '';
    if (!nameplatePicker) return;
    for (const btn of nameplatePicker.querySelectorAll('[data-nameplate]')) {
      const active = (btn.dataset.nameplate || '') === selectedNameplate;
      btn.classList.toggle('is-selected', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    }
  }

  function reapplySenderStylesInTimeline() {
    for (const el of messageList.querySelectorAll('.message[data-sender]')) {
      const sender = el.dataset.sender;
      const style = senderStyleCache.get(sender) || null;
      const senderEl = el.querySelector('.sender');
      applyUsernameStyle(senderEl, style, {
        fallbackColor: el.classList.contains('message--mine')
          ? 'var(--lavender)'
          : nameColorForUser(sender),
      });
    }
    reapplySenderStylesInPins();
  }

  function reapplySenderStylesInPins() {
    if (!roomPinsList) return;
    for (const card of roomPinsList.querySelectorAll('.room-pin-card[data-sender]')) {
      const sender = card.dataset.sender;
      const style = senderStyleCache.get(sender) || null;
      const senderEl = card.querySelector('.room-pin-sender');
      applyUsernameStyle(senderEl, style, {
        fallbackColor: card.dataset.mine === '1' ? 'var(--lavender)' : nameColorForUser(sender),
      });
    }
  }

  async function warmSenderStyles(messages, roomId, token) {
    const ids = [
      ...new Set(
        (messages || [])
          .map((msg) => msg.sender)
          .filter((id) => id && !senderStyleCache.has(id)),
      ),
    ].slice(0, 16);
    if (ids.length === 0) {
      reapplySenderStylesInPins();
      return;
    }
    let changed = false;
    await Promise.all(
      ids.map(async (userId) => {
        try {
          const [profile, colorsRes] = await Promise.all([
            api(
              `/api/profile?userId=${encodeURIComponent(userId)}&roomId=${encodeURIComponent(roomId || '')}`,
            ),
            api(`/api/paarrot-colors?userId=${encodeURIComponent(userId)}`).catch(() => null),
          ]);
          const style = {
            ...(profile.style || {}),
            color:
              colorsRes?.colors?.color ||
              profile.paarrotColors?.color ||
              profile.style?.color ||
              null,
          };
          rememberSenderStyle(userId, style);
          if (style.color || style.nameplate || style.nameGradientStart) changed = true;
        } catch {
          rememberSenderStyle(userId, null);
        }
      }),
    );
    if (token !== messageRefreshToken || activeRoomId !== roomId) return;
    if (changed) reapplySenderStylesInTimeline();
    else reapplySenderStylesInPins();
  }

  async function showUserProfile(userId, clientX, clientY) {
    if (!userId) return;
    hideSpaceMenu();
    hideRoomMenu();
    hideMessageMenu();
    hideAccountMenu();

    try {
      const profile = await api(
        `/api/profile?userId=${encodeURIComponent(userId)}&roomId=${encodeURIComponent(activeRoomId || '')}`,
      );
      profileUser = profile;
      userProfileCard.classList.toggle('user-profile-card--self', Boolean(profile.isSelf));
      userProfileName.textContent = profile.displayName || 'User';
      const mergedStyle = {
        ...(profile.style || {}),
        color: profile.paarrotColors?.color || profile.style?.color || null,
      };
      rememberSenderStyle(profile.userId, mergedStyle);
      applyUsernameStyle(userProfileName, mergedStyle, {
        fallbackColor: profile.isSelf ? 'var(--lavender)' : nameColorForUser(profile.userId),
      });
      userProfileId.textContent = profile.userId || '';
      userProfileId.style.color = profile.isSelf
        ? 'color-mix(in srgb, var(--lavender) 70%, white)'
        : '';
      userProfileOnline.hidden = !profile.online;

      // Banner color/gradient always under optional banner image (image may fail on phone)
      userProfileBanner.style.background = bannerStyleForUser(profile.userId);
      userProfileBannerImg.hidden = true;
      userProfileBannerImg.removeAttribute('src');
      userProfileBannerImg.classList.remove('is-avatar-fill');
      if (profile.style?.gradientStart && profile.style?.gradientEnd) {
        const angle = Number(profile.style.gradientAngle) || 180;
        userProfileBanner.style.background = `linear-gradient(${angle}deg, ${profile.style.gradientStart}, ${profile.style.gradientEnd})`;
      } else if (profile.paarrotColors?.gradient?.startColor && profile.paarrotColors?.gradient?.stopColor) {
        const dir = profile.paarrotColors.gradient.direction || '180deg';
        userProfileBanner.style.background = `linear-gradient(${dir}, ${profile.paarrotColors.gradient.startColor}, ${profile.paarrotColors.gradient.stopColor})`;
      } else if (profile.paarrotColors?.color || profile.style?.color) {
        userProfileBanner.style.background = profile.paarrotColors?.color || profile.style.color;
      }
      if (profile.bannerUrl) {
        userProfileBannerImg.hidden = false;
        userProfileBannerImg.onerror = () => {
          userProfileBannerImg.hidden = true;
          userProfileBannerImg.removeAttribute('src');
        };
        userProfileBannerImg.src = profile.bannerUrl;
      }

      if (profile.statusMsg) {
        userProfileStatus.hidden = false;
        userProfileStatus.textContent = profile.statusMsg;
      } else {
        userProfileStatus.hidden = true;
        userProfileStatus.textContent = '';
      }

      userProfileServer.innerHTML = profile.server
        ? `<span aria-hidden="true">⬡</span> ${profile.server}`
        : '';
      userProfileServer.hidden = !profile.server;

      if (profile.role) {
        userProfileRole.hidden = false;
        userProfileRole.classList.add('user-profile-chip--role');
        userProfileRole.innerHTML = `<span aria-hidden="true">●</span> ${profile.role}`;
      } else {
        userProfileRole.hidden = true;
        userProfileRole.textContent = '';
      }

      // Paarrot: own profile has no Message button — just identity + chips
      userProfileMessageBtn.hidden = Boolean(profile.isSelf);
      userProfileMoreBtn.hidden = Boolean(profile.isSelf);
      if (!profile.isSelf) {
        userProfileMessageBtn.disabled = false;
        userProfileMessageBtn.innerHTML = '<span aria-hidden="true">💬</span> Message';
      }

      const showFallback = () => {
        userProfileAvatar.hidden = true;
        userProfileAvatarFallback.hidden = false;
        userProfileAvatarFallback.textContent = initials(profile.displayName || profile.userId);
      };

      if (profile.hasAvatar !== false && profile.avatarUrl) {
        userProfileAvatarFallback.hidden = true;
        userProfileAvatar.hidden = false;
        userProfileAvatar.onerror = showFallback;
        userProfileAvatar.src = `${profile.avatarUrl}&t=${Date.now()}`;
      } else {
        showFallback();
      }

      applyProfileStyleToCard(profile.style || null);
      // Capacitor: <img src="/api/..."> bypasses fetch — rewrite to blob URLs
      try {
        window.KitsuStandalone?.hydrateMedia?.();
      } catch {
        /* ignore */
      }

      userProfileCard.hidden = false;
      const rect = userProfileCard.getBoundingClientRect();
      const x = Math.min(clientX, window.innerWidth - rect.width - 12);
      const y = Math.min(clientY, window.innerHeight - rect.height - 12);
      userProfileCard.style.left = `${Math.max(12, x)}px`;
      userProfileCard.style.top = `${Math.max(12, y)}px`;
    } catch (error) {
      window.alert(error.message || String(error));
    }
  }

  function showRoomMenu(roomId, clientX, clientY, anchorBtn = null) {
    const room = roomCatalog.find((entry) => entry.roomId === roomId);
    if (!room) return;
    hideSpaceMenu();
    hideMessageMenu();
    contextRoomId = roomId;

    const markReadBtn = roomContextMenu.querySelector('[data-room-action="mark-read"]');
    markReadBtn.disabled = !(room.unread > 0);
    markReadBtn.classList.toggle('is-disabled', markReadBtn.disabled);

    if (anchorBtn) anchorBtn.classList.add('is-open');
    roomContextMenu.hidden = false;
    const rect = roomContextMenu.getBoundingClientRect();
    const x = Math.min(clientX, window.innerWidth - rect.width - 8);
    const y = Math.min(clientY, window.innerHeight - rect.height - 8);
    roomContextMenu.style.left = `${Math.max(8, x)}px`;
    roomContextMenu.style.top = `${Math.max(8, y)}px`;
  }

  function showSpaceMenu(spaceId, clientX, clientY) {
    const space = spaceCatalog.find((entry) => entry.spaceId === spaceId);
    if (!space) return;
    hideRoomMenu();
    hideMessageMenu();
    hideFolderMenu();
    contextSpaceId = spaceId;

    const markReadBtn = spaceContextMenu.querySelector('[data-action="mark-read"]');
    markReadBtn.disabled = !(space.unread > 0);
    markReadBtn.classList.toggle('is-disabled', markReadBtn.disabled);

    const inFolder = Boolean(findSpaceFolder(spaceId));
    const removeBtn = spaceContextMenu.querySelector('[data-action="remove-from-folder"]');
    if (removeBtn) removeBtn.hidden = !inFolder;
    const addBtn = spaceContextMenu.querySelector('[data-action="add-to-folder"]');
    if (addBtn) addBtn.hidden = getSpaceFolders().length === 0;

    spaceContextMenu.hidden = false;
    const rect = spaceContextMenu.getBoundingClientRect();
    const x = Math.min(clientX, window.innerWidth - rect.width - 8);
    const y = Math.min(clientY, window.innerHeight - rect.height - 8);
    spaceContextMenu.style.left = `${Math.max(8, x)}px`;
    spaceContextMenu.style.top = `${Math.max(8, y)}px`;
  }

  function showFolderMenu(folderId, clientX, clientY) {
    const folder = findFolderById(folderId);
    if (!folder || !folderContextMenu) return;
    hideSpaceMenu();
    hideRoomMenu();
    hideMessageMenu();
    contextFolderId = folderId;
    const toggleBtn = folderContextMenu.querySelector('[data-folder-action="toggle"] span');
    if (toggleBtn) toggleBtn.textContent = folder.collapsed ? 'Expand Folder' : 'Collapse Folder';
    folderContextMenu.hidden = false;
    const rect = folderContextMenu.getBoundingClientRect();
    const x = Math.min(clientX, window.innerWidth - rect.width - 8);
    const y = Math.min(clientY, window.innerHeight - rect.height - 8);
    folderContextMenu.style.left = `${Math.max(8, x)}px`;
    folderContextMenu.style.top = `${Math.max(8, y)}px`;
  }

  const FEATURED_THEME_IDS = ['dark', 'midnight', 'light'];
  const LEGACY_THEME_IDS = {
    crimson: 'dark',
    hacker: 'dark',
  };
  const BUILTIN_THEMES = [
    { id: 'dark', label: 'Dark', scheme: 'dark', bg: '#313338', primary: '#5865f2', text: '#f2f3f5' },
    { id: 'midnight', label: 'Midnight', scheme: 'dark', bg: '#020617', primary: '#6366f1', text: '#e0e7ff' },
    { id: 'light', label: 'Light', scheme: 'light', bg: '#e8ebf2', primary: '#5865f2', text: '#1e1b4b' },
  ];

  let appThemeOptions = BUILTIN_THEMES.map((theme) => ({ ...theme }));
  const remoteThemeCssLoaded = new Set();
  const lightThemeIds = new Set(
    BUILTIN_THEMES.filter((theme) => theme.scheme === 'light').map((theme) => theme.id),
  );
  let themeColourFilter = 'all';
  let themeColourQuery = '';
  let themeColourGridEl = null;
  let themeColourEmptyEl = null;
  let themeColourCountEl = null;
  let themeSwatchesMounted = false;

  function isSafeThemeId(value) {
    return typeof value === 'string' && /^[a-z0-9-]+$/i.test(value.trim());
  }

  function coerceTheme(value) {
    if (!isSafeThemeId(value)) return 'dark';
    const id = value.trim().toLowerCase();
    return LEGACY_THEME_IDS[id] || id;
  }

  function persistThemePreference(themeId, isLight) {
    try {
      localStorage.setItem('relay.theme', themeId);
      localStorage.setItem('relay.theme-scheme', isLight ? 'light' : 'dark');
    } catch {
      /* ignore */
    }
  }

  function persistThemeCssCache(themeId, css) {
    if (!css.trim()) return;
    try {
      localStorage.setItem(`relay.theme-css:${themeId}`, css);
    } catch {
      /* ignore quota */
    }
  }

  function applyThemeStyleElement(themeId, css) {
    const styleId = `remote-theme-${themeId}`;
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  }

  function clearProvisionalThemeTokens() {
    const root = document.documentElement;
    [
      '--bg',
      '--primary',
      '--primary-hover',
      '--text',
      '--text-soft',
      '--on-primary',
      '--panel',
      '--panel-muted',
      '--control-bg',
      '--seg-bg',
      '--surface',
      '--surface-hover',
      '--line',
      '--glow-a',
      '--glow-b',
      '--accent-line',
      '--focus-ring',
      '--rail-active-fill',
    ].forEach((prop) => root.style.removeProperty(prop));
  }

  function applyProvisionalThemeTokens(theme) {
    const root = document.documentElement;
    if (!theme) {
      clearProvisionalThemeTokens();
      return;
    }

    const alreadyLoaded =
      remoteThemeCssLoaded.has(theme.id) ||
      Boolean(document.getElementById(`remote-theme-${theme.id}`)?.textContent?.trim());
    if (alreadyLoaded) {
      clearProvisionalThemeTokens();
      return;
    }

    const isLight = theme.scheme === 'light';
    root.style.setProperty('--bg', theme.bg);
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--primary-hover', theme.primary);
    root.style.setProperty('--text', theme.text);
    root.style.setProperty('--text-soft', theme.text);
    root.style.setProperty('--on-primary', theme.bg);
    root.style.setProperty('--panel', isLight ? '#ffffff' : theme.bg);
    root.style.setProperty('--panel-muted', isLight ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.45)');
    root.style.setProperty('--control-bg', isLight ? '#ffffff' : theme.bg);
    root.style.setProperty('--seg-bg', isLight ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.55)');
    root.style.setProperty('--surface', isLight ? '#ffffff' : theme.bg);
    root.style.setProperty('--surface-hover', isLight ? '#f3f4f6' : theme.bg);
    root.style.setProperty('--line', isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)');
    root.style.setProperty('--glow-a', `${theme.primary}33`);
    root.style.setProperty('--glow-b', `${theme.primary}22`);
    root.style.setProperty('--accent-line', `${theme.primary}73`);
    root.style.setProperty('--focus-ring', `${theme.primary}66`);
    root.style.setProperty('--rail-active-fill', `${theme.primary}29`);
  }

  async function ensureRemoteThemeCss(themeId) {
    const id = coerceTheme(themeId);
    if (BUILTIN_THEMES.some((theme) => theme.id === id)) return;

    if (!remoteThemeCssLoaded.has(id)) {
      try {
        const cached = localStorage.getItem(`relay.theme-css:${id}`);
        if (cached && cached.trim()) applyThemeStyleElement(id, cached);
      } catch {
        /* ignore */
      }
    }

    if (remoteThemeCssLoaded.has(id)) return;

    try {
      const response = await fetch(`/api/themes/${encodeURIComponent(id)}/css`);
      if (!response.ok) return;
      const css = await response.text();
      if (!css.trim()) return;

      applyThemeStyleElement(id, css);
      remoteThemeCssLoaded.add(id);
      persistThemeCssCache(id, css);

      const bootStyle = document.getElementById('remote-theme-boot');
      if (bootStyle && document.documentElement.dataset.theme === id) {
        bootStyle.textContent = css;
      }
    } catch {
      /* keep bundled / cached CSS */
    }
  }

  function mergeRemoteThemeCatalog(remoteThemes) {
    const byId = new Map();
    for (const builtin of BUILTIN_THEMES) {
      byId.set(builtin.id, { ...builtin });
    }

    for (const raw of remoteThemes) {
      if (!raw || typeof raw !== 'object' || !isSafeThemeId(raw.id)) continue;
      const id = String(raw.id).trim().toLowerCase();
      if (LEGACY_THEME_IDS[id]) continue;
      const existing = byId.get(id);
      byId.set(id, {
        id,
        label:
          typeof raw.label === 'string' && raw.label.trim()
            ? raw.label.trim()
            : existing?.label || id,
        scheme: raw.scheme === 'light' ? 'light' : 'dark',
        bg: typeof raw.bg === 'string' && raw.bg.trim() ? raw.bg.trim() : existing?.bg || '#111111',
        primary:
          typeof raw.primary === 'string' && raw.primary.trim()
            ? raw.primary.trim()
            : existing?.primary || '#ffffff',
        text:
          typeof raw.text === 'string' && raw.text.trim()
            ? raw.text.trim()
            : existing?.text || '#ffffff',
      });
    }

    lightThemeIds.clear();
    for (const theme of byId.values()) {
      if (theme.scheme === 'light') lightThemeIds.add(theme.id);
    }

    const featured = FEATURED_THEME_IDS.map((id) => byId.get(id)).filter(Boolean);
    const rest = [...byId.values()]
      .filter((theme) => !FEATURED_THEME_IDS.includes(theme.id))
      .sort((a, b) => a.label.localeCompare(b.label));

    appThemeOptions = [...featured, ...rest];
  }

  function createThemeCheckBadge() {
    const check = document.createElement('span');
    check.className = 'theme-swatch-check';
    check.setAttribute('aria-hidden', 'true');
    check.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12.5 10 17.5 19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return check;
  }

  function createDefaultThemeButton(theme) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-default-card';
    button.dataset.themeId = theme.id;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', 'false');
    button.title = `${theme.label} · ${theme.scheme === 'light' ? 'Light' : 'Dark'}`;
    button.style.setProperty('--swatch-bg', theme.bg);
    button.style.setProperty('--swatch-primary', theme.primary);
    button.style.setProperty('--swatch-text', theme.text);
    const face = document.createElement('div');
    face.className = 'theme-default-card-face';
    face.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'theme-default-card-name';
    name.textContent = theme.label;
    button.append(face, name, createThemeCheckBadge());
    button.addEventListener('click', () => {
      if (systemThemeEnabled()) {
        writeBoolPref('relay.systemTheme', false);
        if (prefSystemTheme) prefSystemTheme.checked = false;
      }
      applyTheme(theme.id);
    });
    return button;
  }

  function createColourThemeButton(theme) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-colour-swatch';
    button.dataset.themeId = theme.id;
    button.dataset.themeScheme = theme.scheme;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', 'false');
    button.title = `${theme.label} · ${theme.scheme === 'light' ? 'Light' : 'Dark'}`;
    button.style.setProperty('--swatch-bg', theme.bg);
    button.style.setProperty('--swatch-primary', theme.primary);
    button.style.setProperty('--swatch-text', theme.text);
    const face = document.createElement('span');
    face.className = 'theme-colour-swatch-face';
    face.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'theme-colour-swatch-name';
    name.textContent = theme.label;
    const scheme = document.createElement('span');
    scheme.className = 'theme-colour-swatch-scheme';
    scheme.textContent = theme.scheme === 'light' ? 'Light' : 'Dark';
    button.append(face, name, scheme, createThemeCheckBadge());
    button.addEventListener('click', () => {
      if (systemThemeEnabled()) {
        writeBoolPref('relay.systemTheme', false);
        if (prefSystemTheme) prefSystemTheme.checked = false;
      }
      applyTheme(theme.id);
    });
    return button;
  }

  function getColourThemeOptions() {
    return appThemeOptions.filter((entry) => !FEATURED_THEME_IDS.includes(entry.id));
  }

  function filterColourThemes(themes) {
    const query = themeColourQuery.trim().toLowerCase();
    return themes.filter((theme) => {
      if (themeColourFilter !== 'all' && theme.scheme !== themeColourFilter) return false;
      if (!query) return true;
      return `${theme.label} ${theme.id} ${theme.scheme}`.toLowerCase().includes(query);
    });
  }

  function renderColourThemeGrid() {
    if (!themeColourGridEl) return;
    const colourThemes = getColourThemeOptions();
    const coloursSection = themeColourGridEl.closest('.theme-colour-section');
    if (colourThemes.length === 0) {
      themeColourGridEl.replaceChildren();
      if (coloursSection) coloursSection.hidden = true;
      if (themeColourEmptyEl) themeColourEmptyEl.hidden = true;
      if (themeColourCountEl) themeColourCountEl.textContent = '';
      syncThemeSwatchSelection(coerceTheme(localStorage.getItem('relay.theme') || 'dark'));
      return;
    }
    if (coloursSection) coloursSection.hidden = false;

    const filtered = filterColourThemes(colourThemes);
    themeColourGridEl.replaceChildren(...filtered.map((theme) => createColourThemeButton(theme)));
    if (themeColourEmptyEl) {
      themeColourEmptyEl.hidden = filtered.length > 0;
      themeColourEmptyEl.textContent = 'No themes match.';
    }
    if (themeColourCountEl) {
      themeColourCountEl.textContent =
        filtered.length === colourThemes.length
          ? `${colourThemes.length} themes`
          : `${filtered.length} of ${colourThemes.length}`;
    }
    syncThemeSwatchSelection(coerceTheme(localStorage.getItem('relay.theme') || 'dark'));
  }

  function syncThemeSwatchSelection(themeId) {
    const next = coerceTheme(themeId);
    if (!settingsThemePicker) return;
    for (const button of settingsThemePicker.querySelectorAll('[data-theme-id]')) {
      const selected = button.dataset.themeId === next;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
    }
  }

  function ensureThemeSwatchesMounted() {
    if (themeSwatchesMounted) return;
    themeSwatchesMounted = true;
    settingsThemePicker.replaceChildren();
    themeColourGridEl = null;
    themeColourEmptyEl = null;
    themeColourCountEl = null;

    const defaultsSection = document.createElement('div');
    defaultsSection.className = 'theme-picker-section';
    const defaultsTitle = document.createElement('h4');
    defaultsTitle.className = 'theme-picker-subtitle';
    defaultsTitle.textContent = 'Defaults';
    const defaultsGrid = document.createElement('div');
    defaultsGrid.className = 'theme-default-grid';
    defaultsGrid.setAttribute('role', 'group');
    defaultsGrid.setAttribute('aria-label', 'Default themes');
    for (const themeId of FEATURED_THEME_IDS) {
      const theme = appThemeOptions.find((entry) => entry.id === themeId);
      if (theme) defaultsGrid.append(createDefaultThemeButton(theme));
    }
    defaultsSection.append(defaultsTitle, defaultsGrid);

    const coloursSection = document.createElement('div');
    coloursSection.className = 'theme-picker-section theme-colour-section';
    const coloursHead = document.createElement('div');
    coloursHead.className = 'theme-colour-head';
    const coloursTitleWrap = document.createElement('div');
    coloursTitleWrap.className = 'theme-colour-title-wrap';
    const coloursTitle = document.createElement('h4');
    coloursTitle.className = 'theme-picker-subtitle';
    coloursTitle.textContent = 'More themes';
    themeColourCountEl = document.createElement('span');
    themeColourCountEl.className = 'theme-colour-count';
    coloursTitleWrap.append(coloursTitle, themeColourCountEl);

    const filterGroup = document.createElement('div');
    filterGroup.className = 'theme-colour-filters';
    filterGroup.setAttribute('role', 'tablist');
    filterGroup.setAttribute('aria-label', 'Filter themes by brightness');
    for (const filter of [
      { id: 'all', label: 'All' },
      { id: 'light', label: 'Light' },
      { id: 'dark', label: 'Dark' },
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = filter.label;
      button.classList.toggle('active', themeColourFilter === filter.id);
      button.addEventListener('click', () => {
        themeColourFilter = filter.id;
        for (const entry of filterGroup.querySelectorAll('button')) {
          entry.classList.toggle('active', entry === button);
        }
        renderColourThemeGrid();
      });
      filterGroup.append(button);
    }
    coloursHead.append(coloursTitleWrap, filterGroup);

    const search = document.createElement('input');
    search.className = 'theme-colour-search';
    search.type = 'search';
    search.placeholder = 'Search themes...';
    search.autocomplete = 'off';
    search.addEventListener('input', () => {
      themeColourQuery = search.value;
      renderColourThemeGrid();
    });

    themeColourGridEl = document.createElement('div');
    themeColourGridEl.className = 'theme-colour-grid';
    themeColourEmptyEl = document.createElement('p');
    themeColourEmptyEl.className = 'theme-colour-empty';
    themeColourEmptyEl.textContent = 'Extra themes will load from a Themes repo when configured.';
    themeColourEmptyEl.hidden = true;

    coloursSection.append(coloursHead, search, themeColourGridEl, themeColourEmptyEl);
    settingsThemePicker.append(defaultsSection, coloursSection);
    renderColourThemeGrid();
  }

  function populateThemeSelect() {
    themeSwatchesMounted = false;
    ensureThemeSwatchesMounted();
    syncThemeSwatchSelection(coerceTheme(localStorage.getItem('relay.theme') || 'dark'));
  }

  function applyTheme(themeId, { persist = true } = {}) {
    if (persist && themeId != null) {
      const stored = coerceTheme(themeId);
      const knownStored = appThemeOptions.find((entry) => entry.id === stored);
      const storedLight = knownStored
        ? knownStored.scheme === 'light'
        : lightThemeIds.has(stored);
      persistThemePreference(stored, storedLight);
    }

    const next = systemThemeEnabled()
      ? resolveThemeForSystem()
      : coerceTheme(
          themeId != null ? themeId : localStorage.getItem('relay.theme') || 'dark',
        );
    const known = appThemeOptions.find((entry) => entry.id === next);
    const isLight = known ? known.scheme === 'light' : lightThemeIds.has(next);

    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = isLight ? 'light' : 'dark';
    document.documentElement.classList.toggle('theme-scheme-light', isLight);
    document.documentElement.classList.toggle('theme-scheme-dark', !isLight);
    applyProvisionalThemeTokens(known);
    ensureThemeSwatchesMounted();
    syncThemeSwatchSelection(coerceTheme(localStorage.getItem('relay.theme') || 'dark'));

    void ensureRemoteThemeCss(next).then(() => {
      if (document.documentElement.dataset.theme === next) {
        clearProvisionalThemeTokens();
      }
    });
  }

  async function loadThemes() {
    ensureThemeSwatchesMounted();
    refreshActiveTheme();

    try {
      const res = await fetch('/api/themes');
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.themes) || data.themes.length === 0) return;
      mergeRemoteThemeCatalog(data.themes);
      themeSwatchesMounted = false;
      refreshActiveTheme();
    } catch {
      /* builtins remain */
    }
  }

  let settingsOpen = false;

  function setSettingsTab(tab) {
    for (const button of document.querySelectorAll('[data-settings-tab]')) {
      const active = button.dataset.settingsTab === tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    }
    for (const pane of document.querySelectorAll('[data-settings-pane]')) {
      const active = pane.dataset.settingsPane === tab;
      pane.hidden = !active;
      pane.classList.toggle('active', active);
    }
    // Leaving Devices via sidebar nav → treat as normal Settings (account rail).
    if (tab !== 'devices' && railSecurityBtn?.classList.contains('is-active')) {
      railSecurityBtn.classList.remove('is-active');
      railAccountBtn?.classList.add('is-active');
    }
    if (tab === 'plugins') void refreshSettingsPlugins();
    if (tab === 'account') void refreshAccountSettings();
    if (tab === 'general') {
      loadGeneralPrefs();
      void refreshSettingsSession();
    }
    if (tab === 'notifications') loadNotificationSettings();
    if (tab === 'audio') void loadAudioVideoSettings();
    if (tab === 'devices') void refreshDevicesSettings();
    if (tab === 'appearance') {
      loadAppearancePrefs();
      loadTwitterEmojiSetting();
    }
    if (tab === 'emojis') {
      void refreshEmojiStickerSettings();
    }
    if (tab === 'devtools') loadDeveloperToolsSettings();
    if (tab === 'about') void refreshAboutSettings();
  }

  function hexToRgba(hex, alphaPct) {
    const raw = String(hex || '#888888').replace('#', '');
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.padEnd(6, '0').slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    const a = Math.max(0, Math.min(100, Number(alphaPct) || 100)) / 100;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function currentStyleFromInputs() {
    return {
      avatarBorder: hexToRgba(styleBorderColor.value, styleBorderAlpha.value),
      gradientStart: styleGradStart.value,
      gradientEnd: styleGradEnd.value,
      gradientAngle: Number(styleGradAngle.value) || 180,
      nameplate: selectedNameplate || null,
      nameGradientStart: styleNameGradStart?.value || null,
      nameGradientEnd: styleNameGradEnd?.value || null,
      color: styleNameGradStart?.value || null,
    };
  }

  function updateStylePreview() {
    const style = currentStyleFromInputs();
    styleGradAngleLabel.textContent = `${style.gradientAngle}°`;
    styleGradPreview.style.background = `linear-gradient(${style.gradientAngle}deg, ${style.gradientStart}, ${style.gradientEnd})`;
    const avatar = accountPreviewAvatar.hidden ? accountPreviewAvatarFallback : accountPreviewAvatar;
    avatar.style.boxShadow = `0 0 0 3px ${style.avatarBorder}`;
    if (accountPreviewBannerImg.hidden) {
      accountPreviewBanner.style.background = `linear-gradient(${style.gradientAngle}deg, ${style.gradientStart}, ${style.gradientEnd})`;
    }
    if (styleNamePreviewText) {
      styleNamePreviewText.textContent = accountPreviewName.textContent || 'Username';
      applyUsernameStyle(styleNamePreviewText, style);
    }
    applyUsernameStyle(accountPreviewName, style, { fallbackColor: 'var(--text)' });
  }

  function applyProfileStyleToCard(style) {
    if (!style) {
      userProfileAvatar.style.boxShadow = '';
      userProfileAvatarFallback.style.boxShadow = '';
      userProfileCard.style.background = '';
      return;
    }
    if (style.avatarBorder) {
      userProfileAvatar.style.boxShadow = `0 0 0 3px ${style.avatarBorder}`;
      userProfileAvatarFallback.style.boxShadow = `0 0 0 3px ${style.avatarBorder}`;
    }
    if (style.gradientStart && style.gradientEnd) {
      const angle = Number(style.gradientAngle) || 180;
      userProfileCard.style.background = `linear-gradient(${angle}deg, ${style.gradientStart}, ${style.gradientEnd})`;
    }
  }

  function renderBlockedUsers(ids) {
    blockedUserList.innerHTML = '';
    if (!ids.length) {
      blockedUserList.innerHTML = '<li class="settings-muted">No blocked users</li>';
      return;
    }
    for (const id of ids) {
      const li = document.createElement('li');
      li.innerHTML = `<code></code><button type="button" class="ghost">Unblock</button>`;
      li.querySelector('code').textContent = id;
      li.querySelector('button').addEventListener('click', async () => {
        try {
          const result = await api('/api/account/unblock', {
            method: 'POST',
            body: JSON.stringify({ userId: id }),
          });
          renderBlockedUsers(result.ignored || []);
        } catch (error) {
          window.alert(error.message || String(error));
        }
      });
      blockedUserList.appendChild(li);
    }
  }

  async function refreshAccountSettings() {
    try {
      const account = await api('/api/account');
      accountPreviewName.textContent = account.displayName || 'User';
      accountPreviewId.textContent = account.userId || '';
      accountMatrixId.textContent = account.userId || '—';
      if (accountDisplayNameInput) {
        accountDisplayNameInput.value = account.displayName || '';
      }
      accountPreviewServer.textContent = account.server || '';
      accountPreviewServer.hidden = !account.server;
      accountStatusBtn.textContent = account.statusMsg || 'Click to set a custom status…';
      accountStatusBtn.classList.toggle('is-empty', !account.statusMsg);
      if (accountPreviewOnline) {
        accountPreviewOnline.hidden = !(account.online || account.presence === 'online');
        accountPreviewOnline.title = account.presence || (account.online ? 'online' : 'offline');
      }

      const emails = Array.isArray(account.emails)
        ? account.emails
        : account.email
          ? [account.email]
          : [];
      if (emails.length) {
        accountEmail.textContent = emails.join(', ');
        accountEmail.classList.remove('settings-muted');
      } else {
        accountEmail.textContent = 'No email attached to this account.';
        accountEmail.classList.add('settings-muted');
      }

      if (account.role) {
        accountPreviewRole.hidden = false;
        accountPreviewRole.textContent = account.role;
      } else {
        accountPreviewRole.hidden = true;
      }

      const showFallback = () => {
        accountPreviewAvatar.hidden = true;
        accountPreviewAvatarFallback.hidden = false;
        accountPreviewAvatarFallback.textContent = initials(account.displayName || account.userId);
      };
      if (account.hasAvatar !== false && account.avatarUrl) {
        accountPreviewAvatarFallback.hidden = true;
        accountPreviewAvatar.hidden = false;
        accountPreviewAvatar.onerror = showFallback;
        accountPreviewAvatar.src = `${account.avatarUrl}&t=${Date.now()}`;
      } else {
        showFallback();
      }

      if (account.bannerUrl) {
        accountPreviewBannerImg.hidden = false;
        accountPreviewBannerImg.src = account.bannerUrl;
      } else {
        accountPreviewBannerImg.hidden = true;
        accountPreviewBannerImg.removeAttribute('src');
        const grad = account.paarrotColors?.gradient;
        if (grad?.startColor && grad?.stopColor) {
          accountPreviewBanner.style.background = `linear-gradient(${grad.direction || '180deg'}, ${grad.startColor}, ${grad.stopColor})`;
        } else if (account.style?.gradientStart && account.style?.gradientEnd) {
          const angle = Number(account.style.gradientAngle) || 180;
          accountPreviewBanner.style.background = `linear-gradient(${angle}deg, ${account.style.gradientStart}, ${account.style.gradientEnd})`;
        } else if (account.paarrotColors?.color) {
          accountPreviewBanner.style.background = account.paarrotColors.color;
        }
      }

      const style = account.style || {};
      rememberSenderStyle(account.userId, {
        ...style,
        color: account.paarrotColors?.color || style.color || null,
      });
      if (style.gradientStart?.startsWith('#')) styleGradStart.value = style.gradientStart.slice(0, 7);
      if (style.gradientEnd?.startsWith('#')) styleGradEnd.value = style.gradientEnd.slice(0, 7);
      if (Number.isFinite(Number(style.gradientAngle))) styleGradAngle.value = String(style.gradientAngle);
      const accent = account.paarrotColors?.color || style.color;
      if (accent?.startsWith('#')) {
        styleNameGradStart.value = accent.slice(0, 7);
        styleNameGradEnd.value = (account.paarrotColors?.gradient?.stopColor || accent).slice(0, 7);
      } else {
        if (style.nameGradientStart?.startsWith('#')) styleNameGradStart.value = style.nameGradientStart.slice(0, 7);
        if (style.nameGradientEnd?.startsWith('#')) styleNameGradEnd.value = style.nameGradientEnd.slice(0, 7);
      }
      if (account.paarrotColors?.gradient?.startColor?.startsWith('#')) {
        styleGradStart.value = account.paarrotColors.gradient.startColor.slice(0, 7);
      }
      if (account.paarrotColors?.gradient?.stopColor?.startsWith('#')) {
        styleGradEnd.value = account.paarrotColors.gradient.stopColor.slice(0, 7);
      }
      setNameplateSelection(style.nameplate || '');
      updateStylePreview();
      if (style.avatarBorder) {
        const avatar = accountPreviewAvatar.hidden ? accountPreviewAvatarFallback : accountPreviewAvatar;
        avatar.style.boxShadow = `0 0 0 3px ${style.avatarBorder}`;
      }
      renderBlockedUsers(account.ignoredUsers || []);
    } catch (error) {
      console.error(error);
    }
  }

  async function refreshSettingsPlugins() {
    try {
      const data = await api('/api/plugins');
      const plugins = data.plugins || [];
      settingsPluginList.innerHTML = '';
      if (plugins.length === 0) {
        settingsPluginList.innerHTML = '<p class="settings-muted">No plugins installed.</p>';
        return;
      }
      for (const plugin of plugins) {
        const row = document.createElement('div');
        row.className = 'plugin-row';
        row.innerHTML = `
          <div>
            <strong></strong>
            <p></p>
          </div>
          <button type="button" class="ghost"></button>
        `;
        row.querySelector('strong').textContent = plugin.name || plugin.id;
        row.querySelector('p').textContent = plugin.description || plugin.id;
        const toggle = row.querySelector('button');
        toggle.textContent = plugin.enabled ? 'Disable' : 'Enable';
        toggle.addEventListener('click', async () => {
          const path = plugin.enabled
            ? `/api/plugins/${encodeURIComponent(plugin.id)}/disable`
            : `/api/plugins/${encodeURIComponent(plugin.id)}/enable`;
          await api(path, { method: 'POST', body: '{}' });
          await refreshSettingsPlugins();
        });
        settingsPluginList.appendChild(row);
      }
    } catch (error) {
      settingsPluginList.innerHTML = `<p class="settings-muted">${error.message || error}</p>`;
    }
  }

  function applySettingsSession(session) {
    if (!settingsSessionUser) return;
    const live = session?.connected && session?.userId ? session : null;
    const fallbackId = sessionUserId || lastSessionState?.userId || null;
    if (live) {
      settingsSessionUser.textContent = live.displayName && live.displayName !== live.userId
        ? `${live.displayName} · ${live.userId}`
        : live.userId;
      if (settingsSessionHomeserver) {
        settingsSessionHomeserver.textContent = live.homeserver || '';
      }
      return;
    }
    if (fallbackId) {
      settingsSessionUser.textContent = fallbackId;
      if (settingsSessionHomeserver) {
        settingsSessionHomeserver.textContent = lastSessionState?.homeserver || '';
      }
      return;
    }
    settingsSessionUser.textContent = 'Not signed in';
    if (settingsSessionHomeserver) settingsSessionHomeserver.textContent = '';
  }

  async function refreshSettingsSession() {
    applySettingsSession(lastSessionState);
    try {
      const session = await api('/api/session');
      if (session?.connected && session?.userId) {
        lastSessionState = session;
        sessionUserId = session.userId;
      }
      applySettingsSession(session);
      try {
        updateAccountAvatar(session);
      } catch {
        // Avatar chrome must not wipe session labels.
      }
    } catch {
      applySettingsSession(lastSessionState);
    }
  }

  async function openSettings({ tab = 'general', fromSecurity = false } = {}) {
    settingsOpen = true;
    closeMessageSearch();
    hideAccountMenu();
    chatMain.hidden = true;
    settingsView.hidden = false;
    if (fromSecurity) {
      railAccountBtn.classList.remove('is-active');
      railSecurityBtn?.classList.add('is-active');
    } else {
      railAccountBtn.classList.add('is-active');
      railSecurityBtn?.classList.remove('is-active');
    }
    // Paint known session immediately so General never flashes "Not signed in".
    applySettingsSession(lastSessionState);
    setSettingsTab(tab);
    if (tab !== 'general') await refreshSettingsSession();
    try {
      const health = await api('/api/health');
      if (settingsVersion) settingsVersion.textContent = `v${health.version || '0.1.0'}`;
    } catch {
      if (settingsVersion) settingsVersion.textContent = 'v0.1.0';
    }
  }

  function closeSettings() {
    settingsOpen = false;
    chatMain.hidden = false;
    settingsView.hidden = true;
    railAccountBtn.classList.remove('is-active');
    railSecurityBtn?.classList.remove('is-active');
  }

  for (const button of document.querySelectorAll('[data-settings-tab]')) {
    button.addEventListener('click', () => setSettingsTab(button.dataset.settingsTab));
  }

  function updateAccountAvatar(session) {
    if (session?.connected && session?.userId) {
      lastSessionState = session;
      sessionUserId = session.userId;
    }
    if (!session?.connected) {
      railAccountBtn.hidden = true;
      updateSecurityBadge({ loggedIn: false });
      return;
    }

    railAccountBtn.hidden = false;
    railAccountBtn.title = 'Settings';
    railAccountBtn.setAttribute('aria-label', 'Settings');
    accountMenuName.textContent = session.displayName || session.userId || 'Account';
    accountMenuId.textContent = session.userId || '';

    railAccountOrb.replaceChildren();
    if (session.hasAvatar !== false && session.avatarUrl) {
      const img = document.createElement('img');
      img.className = 'workspace-rail-avatar';
      img.alt = '';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener(
        'error',
        () => {
          railAccountOrb.textContent = initials(session.displayName || session.userId || '?');
        },
        { once: true },
      );
      img.src = session.avatarUrl;
      railAccountOrb.appendChild(img);
    } else {
      railAccountOrb.textContent = initials(session.displayName || session.userId || '?');
    }
    void refreshSecurityBadge();
  }

  function hideAccountMenu() {
    accountMenu.hidden = true;
  }

  function hideRailAddMenu() {
    if (railAddMenu) railAddMenu.hidden = true;
    railAddBtn?.classList.remove('is-active');
    railAddBtn?.setAttribute('aria-expanded', 'false');
  }

  function showRailAddMenu() {
    if (!railAddMenu || !railAddBtn) return;
    hideAccountMenu();
    hideSpaceMenu();
    hideRoomMenu();
    hideMessageMenu();
    railAddMenu.hidden = false;
    railAddBtn.classList.add('is-active');
    railAddBtn.setAttribute('aria-expanded', 'true');
    const btnRect = railAddBtn.getBoundingClientRect();
    const menuRect = railAddMenu.getBoundingClientRect();
    let left = btnRect.right + 10;
    let top = btnRect.top;
    left = Math.min(left, window.innerWidth - menuRect.width - 8);
    top = Math.max(8, Math.min(top, window.innerHeight - menuRect.height - 8));
    railAddMenu.style.left = `${Math.max(8, left)}px`;
    railAddMenu.style.top = `${top}px`;
  }

  function setCreateSpaceError(message) {
    if (!createSpaceError) return;
    if (!message) {
      createSpaceError.hidden = true;
      createSpaceError.textContent = '';
      return;
    }
    createSpaceError.hidden = false;
    createSpaceError.textContent = message;
  }

  function syncCreateSpaceAccessUi() {
    const selected = createSpaceForm?.querySelector('input[name="createSpaceAccess"]:checked');
    const access = selected?.value || 'private';
    createSpaceForm?.querySelectorAll('label.create-room-access-card').forEach((card) => {
      const input = card.querySelector('input[name="createSpaceAccess"]');
      card.classList.toggle('is-selected', Boolean(input?.checked));
    });
    if (createSpaceNamePrefix) {
      createSpaceNamePrefix.innerHTML =
        access === 'public'
          ? '<svg class="ui-icon ui-icon--stroke" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>'
          : '<svg class="ui-icon ui-icon--stroke" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
    }
  }

  function hideCreateSpaceTypeMenu() {
    if (!createSpaceTypeMenu) return;
    createSpaceTypeMenu.hidden = true;
    createSpaceTypeBtn?.setAttribute('aria-expanded', 'false');
  }

  function setCreateSpaceType(type) {
    const next = type === 'forum' ? 'forum' : 'space';
    if (createSpaceType) createSpaceType.value = next;
    if (createSpaceTypeLabel) {
      createSpaceTypeLabel.textContent = next === 'forum' ? 'Forum Space' : 'Space';
    }
    createSpaceTypeMenu?.querySelectorAll('[data-space-type]').forEach((btn) => {
      btn.classList.toggle('is-selected', btn.dataset.spaceType === next);
    });
    hideCreateSpaceTypeMenu();
  }

  function openCreateSpaceDialog() {
    hideRailAddMenu();
    setCreateSpaceError('');
    if (createSpaceName) createSpaceName.value = '';
    if (createSpaceTopic) createSpaceTopic.value = '';
    if (createSpaceFederation) createSpaceFederation.checked = true;
    if (createSpaceAdvanceOptions) createSpaceAdvanceOptions.hidden = true;
    if (createSpaceAdvanceToggle) {
      createSpaceAdvanceToggle.innerHTML =
        'Advance Options <span aria-hidden="true">▾</span>';
    }
    const privateRadio = createSpaceForm?.querySelector(
      'input[name="createSpaceAccess"][value="private"]',
    );
    if (privateRadio) privateRadio.checked = true;
    setCreateSpaceType('space');
    syncCreateSpaceAccessUi();
    if (typeof createSpaceDialog?.showModal === 'function') {
      createSpaceDialog.showModal();
      createSpaceName?.focus();
    }
  }

  function closeCreateSpaceDialog() {
    hideCreateSpaceTypeMenu();
    if (createSpaceDialog?.open) createSpaceDialog.close();
  }

  function showAccountMenu(clientX, clientY) {
    hideRailAddMenu();
    accountMenu.hidden = false;
    const rect = accountMenu.getBoundingClientRect();
    const x = Math.min(clientX, window.innerWidth - rect.width - 8);
    const y = Math.min(clientY, window.innerHeight - rect.height - 8);
    accountMenu.style.left = `${Math.max(8, x)}px`;
    accountMenu.style.top = `${Math.max(8, y)}px`;
  }

  async function doLogout() {
    hideAccountMenu();
    closeSettings();
    await api('/api/logout', { method: 'POST', body: '{}' });
    activeRoomId = null;
    didRestoreLastRoom = false;
    activeSpaceFilter = 'dms';
    localStorage.setItem('relay.space', 'dms');
    localStorage.removeItem('relay.lastRoomId');
    localStorage.removeItem('relay.lastRoomSpace');
    roomList.innerHTML = '';
    spaceRailList.innerHTML = '';
    messageList.innerHTML = '';
    composerForm.hidden = true;
    railAccountBtn.hidden = true;
    updateSecurityBadge({ loggedIn: false });
    showLogin('doLogout');
  }

  settingsNavLogoutBtn.addEventListener('click', () => {
    void doLogout();
  });

  for (const input of [
    styleBorderColor,
    styleBorderAlpha,
    styleGradStart,
    styleGradEnd,
    styleGradAngle,
    styleNameGradStart,
    styleNameGradEnd,
  ]) {
    input?.addEventListener('input', updateStylePreview);
  }

  nameplatePicker?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-nameplate]');
    if (!btn) return;
    setNameplateSelection(btn.dataset.nameplate || '');
    if (selectedNameplate === 'panda') {
      void (async () => {
        try {
          const data = await api('/api/nameplates/panda/meta');
          const colors = data.colors || {};
          if (colors.color?.startsWith('#')) styleNameGradStart.value = colors.color.slice(0, 7);
          if (colors.gradient?.stopColor?.startsWith('#')) {
            styleNameGradEnd.value = colors.gradient.stopColor.slice(0, 7);
          } else if (colors.color?.startsWith('#')) {
            styleNameGradEnd.value = colors.color.slice(0, 7);
          }
          if (colors.gradient?.startColor?.startsWith('#')) {
            styleGradStart.value = colors.gradient.startColor.slice(0, 7);
          }
          if (colors.gradient?.stopColor?.startsWith('#')) {
            styleGradEnd.value = colors.gradient.stopColor.slice(0, 7);
          }
          if (colors.avatarBorderColor?.startsWith('#')) {
            styleBorderColor.value = colors.avatarBorderColor.slice(0, 7);
          }
          updateStylePreview();
        } catch {
          updateStylePreview();
        }
      })();
      return;
    }
    updateStylePreview();
  });

  styleSaveBtn.addEventListener('click', async () => {
    try {
      const style = currentStyleFromInputs();
      await api('/api/account/style', {
        method: 'PUT',
        body: JSON.stringify({ style }),
      });
      await refreshAccountSettings();
      if (activeRoomId) void refreshMessages(activeRoomId, { quiet: true });
      window.alert('Profile style saved for Kitsu users');
    } catch (error) {
      window.alert(error.message || String(error));
    }
  });

  styleRemoveBtn.addEventListener('click', async () => {
    try {
      await api('/api/account/style', {
        method: 'PUT',
        body: JSON.stringify({ style: null }),
      });
      styleBorderColor.value = '#8e3af3';
      styleBorderAlpha.value = '100';
      styleGradStart.value = '#8e3af3';
      styleGradEnd.value = '#1c1020';
      styleGradAngle.value = '180';
      styleNameGradStart.value = '#B78EE4';
      styleNameGradEnd.value = '#8A4DBF';
      setNameplateSelection('');
      updateStylePreview();
      await refreshAccountSettings();
      if (activeRoomId) void refreshMessages(activeRoomId, { quiet: true });
    } catch (error) {
      window.alert(error.message || String(error));
    }
  });

  accountStatusBtn.addEventListener('click', async () => {
    const next = window.prompt(
      'Custom status',
      accountStatusBtn.classList.contains('is-empty') ? '' : accountStatusBtn.textContent,
    );
    if (next == null) return;
    try {
      await api('/api/account/status', {
        method: 'POST',
        body: JSON.stringify({ statusMsg: next }),
      });
      await refreshAccountSettings();
    } catch (error) {
      window.alert(error.message || String(error));
    }
  });

  accountDisplayNameSaveBtn?.addEventListener('click', async () => {
    const displayName = String(accountDisplayNameInput?.value || '').trim();
    if (!displayName) {
      window.alert('Enter a display name');
      return;
    }
    try {
      accountDisplayNameSaveBtn.disabled = true;
      await api('/api/account/displayname', {
        method: 'PUT',
        body: JSON.stringify({ displayName }),
      });
      await refreshAccountSettings();
    } catch (error) {
      window.alert(error.message || String(error));
    } finally {
      accountDisplayNameSaveBtn.disabled = false;
    }
  });

  accountCopyIdBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(accountMatrixId.textContent || '');
      accountCopyIdBtn.textContent = 'Copied';
      setTimeout(() => {
        accountCopyIdBtn.textContent = 'Copy';
      }, 1000);
    } catch (error) {
      window.alert(error.message || String(error));
    }
  });

  accountPreviewShareBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`https://matrix.to/#/${accountMatrixId.textContent || ''}`);
      accountPreviewShareBtn.textContent = 'Copied';
      setTimeout(() => {
        accountPreviewShareBtn.textContent = 'Share';
      }, 1000);
    } catch (error) {
      window.alert(error.message || String(error));
    }
  });

  async function uploadAccountImage(file, asBanner) {
    if (!isImageFile(file)) {
      throw new Error('Supported images: PNG, APNG, JPEG, GIF, WebP, BMP, AVIF.');
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
    await api('/api/account/image', {
      method: 'POST',
      body: JSON.stringify({ dataUrl, asBanner }),
    });
    await refreshAccountSettings();
  }

  accountAvatarFile.addEventListener('change', async () => {
    const file = accountAvatarFile.files?.[0];
    accountAvatarFile.value = '';
    if (!file) return;
    try {
      await uploadAccountImage(file, false);
    } catch (error) {
      window.alert(error.message || String(error));
    }
  });

  accountBannerFile.addEventListener('change', async () => {
    const file = accountBannerFile.files?.[0];
    accountBannerFile.value = '';
    if (!file) return;
    try {
      await uploadAccountImage(file, true);
    } catch (error) {
      window.alert(error.message || String(error));
    }
  });

  blockUserBtn.addEventListener('click', async () => {
    const userId = blockUserInput.value.trim();
    if (!userId) return;
    try {
      const result = await api('/api/account/block', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      blockUserInput.value = '';
      renderBlockedUsers(result.ignored || []);
    } catch (error) {
      window.alert(error.message || String(error));
    }
  });

  railAccountBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    hideAccountMenu();
    hideRailAddMenu();
    if (settingsOpen && !railSecurityBtn?.classList.contains('is-active')) closeSettings();
    else void openSettings();
  });

  railSecurityBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    hideAccountMenu();
    hideRailAddMenu();
    if (settingsOpen && railSecurityBtn.classList.contains('is-active')) closeSettings();
    else void openDevicesSettings();
  });

  railAddBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!railAddMenu?.hidden) {
      hideRailAddMenu();
      return;
    }
    showRailAddMenu();
  });

  railSearchBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (isQuickSwitcherOpen()) closeQuickSwitcher();
    else void openQuickSwitcher();
  });

  quickSwitcher?.addEventListener('close', () => {
    railSearchBtn?.classList.remove('is-active');
  });

  quickSwitcher?.addEventListener('click', (event) => {
    if (event.target === quickSwitcher) closeQuickSwitcher();
  });

  quickSwitcherInput?.addEventListener('input', () => {
    quickSwitchIndex = 0;
    renderQuickSwitcherResults();
  });

  quickSwitcherInput?.addEventListener('keydown', (event) => {
    const visible = getVisibleQuickSwitchEntries();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!visible.length) return;
      quickSwitchIndex = (quickSwitchIndex + 1) % visible.length;
      syncQuickSwitcherActive();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!visible.length) return;
      quickSwitchIndex = (quickSwitchIndex - 1 + visible.length) % visible.length;
      syncQuickSwitcherActive();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const entry = visible[quickSwitchIndex];
      if (entry) void activateQuickSwitchEntry(entry);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeQuickSwitcher();
    }
  });

  railAddMenu?.addEventListener('click', (event) => {
    const item = event.target.closest('[data-rail-add]');
    if (!item) return;
    const action = item.dataset.railAdd;
    hideRailAddMenu();
    if (action === 'create-space') openCreateSpaceDialog();
    if (action === 'join-address') openJoinDialog();
  });

  createSpaceCancel?.addEventListener('click', () => closeCreateSpaceDialog());
  createSpaceForm?.querySelectorAll('input[name="createSpaceAccess"]').forEach((input) => {
    input.addEventListener('change', () => syncCreateSpaceAccessUi());
  });
  createSpaceAdvanceToggle?.addEventListener('click', () => {
    if (!createSpaceAdvanceOptions) return;
    const open = createSpaceAdvanceOptions.hidden;
    createSpaceAdvanceOptions.hidden = !open;
    createSpaceAdvanceToggle.innerHTML = open
      ? 'Advance Options <span aria-hidden="true">▴</span>'
      : 'Advance Options <span aria-hidden="true">▾</span>';
  });
  createSpaceTypeBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!createSpaceTypeMenu) return;
    const open = createSpaceTypeMenu.hidden;
    createSpaceTypeMenu.hidden = !open;
    createSpaceTypeBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  createSpaceTypeMenu?.addEventListener('click', (event) => {
    const option = event.target.closest('[data-space-type]');
    if (!option) return;
    setCreateSpaceType(option.dataset.spaceType);
  });
  document.addEventListener('click', (event) => {
    if (!createSpaceTypeMenu || createSpaceTypeMenu.hidden) return;
    if (event.target.closest?.('.create-space-type-menu')) return;
    hideCreateSpaceTypeMenu();
  });
  createSpaceForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = String(createSpaceName?.value || '').trim();
    const topic = String(createSpaceTopic?.value || '').trim();
    const access =
      createSpaceForm.querySelector('input[name="createSpaceAccess"]:checked')?.value ||
      'private';
    const forumLayout = createSpaceType?.value === 'forum';
    const allowFederation = createSpaceFederation
      ? Boolean(createSpaceFederation.checked)
      : true;
    if (!name) {
      setCreateSpaceError('Enter a space name');
      createSpaceName?.focus();
      return;
    }
    setCreateSpaceError('');
    const submit = document.getElementById('createSpaceSubmit');
    if (submit) submit.disabled = true;
    try {
      const result = await api('/api/spaces', {
        method: 'POST',
        body: JSON.stringify({
          name,
          topic,
          access,
          forumLayout,
          allowFederation,
        }),
      });
      closeCreateSpaceDialog();
      await refreshSpaces();
      if (result.roomId) setSpaceFilter(result.roomId);
    } catch (error) {
      setCreateSpaceError((error.message || String(error)).replace(/^MatrixError:\s*/i, ''));
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  createChildCancel?.addEventListener('click', () => closeCreateChildDialog());
  createChildForm?.querySelectorAll('input[name="createChildAccess"]').forEach((input) => {
    input.addEventListener('change', () => syncCreateChildAccessUi());
  });
  createChildAdvanceToggle?.addEventListener('click', () => {
    if (!createChildAdvanceOptions) return;
    const open = createChildAdvanceOptions.hidden;
    createChildAdvanceOptions.hidden = !open;
    createChildAdvanceToggle.innerHTML = open
      ? 'Advance Options <span aria-hidden="true">▴</span>'
      : 'Advance Options <span aria-hidden="true">▾</span>';
  });
  createChildForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const parentId = String(createChildParentId?.value || activeSpaceFilter || '').trim();
    const kind = String(createChildKind?.value || 'room').toLowerCase();
    const name = String(createChildName?.value || '').trim();
    const topic = String(createChildTopic?.value || '').trim();
    const access = getCreateChildAccess();
    const encryption = Boolean(createChildEncryption?.checked) && access !== 'public';
    const forumLayout = Boolean(createChildForum?.checked);
    const knock = Boolean(createChildKnock?.checked) && access !== 'public';
    const allowFederation = createChildFederation ? Boolean(createChildFederation.checked) : true;
    const aliasLocalPart = String(createChildAlias?.value || '').trim();
    if (!parentId.startsWith('!')) return;
    if (!name) {
      if (createChildError) {
        createChildError.hidden = false;
        createChildError.textContent =
          kind === 'space' ? 'Enter a space name' : 'Enter a room name';
      }
      return;
    }
    if (createChildError) {
      createChildError.hidden = true;
      createChildError.textContent = '';
    }
    if (createChildSubmit) createChildSubmit.disabled = true;
    try {
      let result;
      if (kind === 'subroom') {
        const spaceId = String(activeSpaceFilter || '').startsWith('!')
          ? activeSpaceFilter
          : null;
        result = await api(`/api/rooms/${encodeURIComponent(parentId)}/subrooms`, {
          method: 'POST',
          body: JSON.stringify({ name, topic, spaceId }),
        });
      } else {
        result = await api(`/api/spaces/${encodeURIComponent(parentId)}/children`, {
          method: 'POST',
          body: JSON.stringify({
            name,
            topic,
            kind: kind === 'space' ? 'space' : 'room',
            access,
            encryption,
            forumLayout,
            knock,
            allowFederation,
            aliasLocalPart: access === 'public' ? aliasLocalPart : undefined,
          }),
        });
      }
      closeCreateChildDialog();
      await refreshSpaces();
      await refreshRooms();
      if (lobbyOpen) renderLobby();
      if (forumOpen) void loadForumBoard({ quiet: true });
      if ((result?.isSpace || result?.isForum) && result.roomId) {
        if (name) spaceNameCache.set(result.roomId, name);
        setSpaceFilter(result.roomId, { openFirst: false });
      } else if (result?.roomId) {
        const room =
          roomCatalog.find((entry) => entry.roomId === result.roomId) || {
            roomId: result.roomId,
            name,
          };
        openRoomEntry(room);
      }
    } catch (error) {
      if (createChildError) {
        createChildError.hidden = false;
        createChildError.textContent = (error.message || String(error)).replace(
          /^MatrixError:\s*/i,
          '',
        );
      }
    } finally {
      if (createChildSubmit) createChildSubmit.disabled = false;
    }
  });

  accountMenu.addEventListener('click', (event) => {
    const item = event.target.closest('[data-account-action]');
    if (!item) return;
    const action = item.dataset.accountAction;
    hideAccountMenu();
    if (action === 'profile') {
      const rect = railAccountBtn.getBoundingClientRect();
      const userId = accountMenuId.textContent || '';
      if (userId.startsWith('@')) {
        void showUserProfile(userId, rect.right + 8, rect.top);
      }
    }
    if (action === 'settings') void openSettings();
    if (action === 'logout') void doLogout();
  });

  function showLogin(reason = 'unspecified') {
    // Already on login — avoid re-entry (stack/logging spam + VoIP thrash).
    if (!loginView.hidden && chatView.hidden) return;
    if (reason && reason !== 'unspecified') {
      console.info('[relay] showLogin:', reason);
    }
    loginView.hidden = false;
    chatView.hidden = true;
    railAccountBtn.hidden = true;
    updateSecurityBadge({ loggedIn: false });
    hideAccountMenu();
    stopPolling();
    timelineCallActions.hidden = true;
    incomingCallBanner.hidden = true;
    callMediaDock.hidden = true;
    setMembersPanelOpen(false);
    setRoomSearchOpen(false);
    window.RelayVoip?.stop();
    sessionUserId = null;
    lastSessionState = null;
    activityCursor = 0;
    activityReady = false;
  }

  function showChat(session) {
    console.info('[relay] showChat:', session?.userId || '(unknown)');
    loginView.hidden = true;
    chatView.hidden = false;
    sessionUserId = session?.userId || null;
    if (session?.connected && session?.userId) lastSessionState = session;
    updateAccountAvatar(session);
    applySettingsSession(session);
    syncWorkspaceRailSelection();
    activityReady = false;
    startPolling();
    void window.RelayVoip?.start(sessionUserId);
    void ensureLiveKit().catch(() => {});
    updateCallChrome();
    void ensureNotificationPermission();
    void refreshSecurityBadge();
    if (isMobileUi()) {
      membersPanelOpen = false;
      sharedMediaOpen = false;
      localStorage.setItem('relay.membersDrawer', '0');
      updateChatStageDrawers();
      if (!activeRoomId) setRoomsDrawerOpen(true);
      else syncMobileNavOverlay();
    } else {
      syncMobileNavOverlay();
    }
  }

  function roomLabel(roomId) {
    const room = roomCatalog.find((entry) => entry.roomId === roomId);
    return room?.name || roomId || 'Call';
  }

  function clearTimelineHead() {
    activeRoomName.textContent = 'Select a room';
    if (activeRoomAvatar) {
      activeRoomAvatar.hidden = true;
      activeRoomAvatar.removeAttribute('src');
    }
    if (activeRoomAvatarFallback) {
      activeRoomAvatarFallback.hidden = true;
      activeRoomAvatarFallback.textContent = '';
    }
    if (roomPinsBadge) {
      roomPinsBadge.hidden = true;
      roomPinsBadge.textContent = '0';
    }
    if (roomSearchBtn) roomSearchBtn.hidden = true;
    setRoomSearchOpen(false);
    hideRoomPinsPanel();
    if (isMobileUi()) setRoomsDrawerOpen(true);
    hideRoomThreadsPanel();
    setSharedMediaOpen(false);
    hideRoomMenu();
    activeRoomMessages = [];
    timelineAtStart = true;
    loadingOlderMessages = false;
  }

  function updateTimelineHead(room) {
    if (!room) {
      clearTimelineHead();
      return;
    }

    activeRoomName.textContent = room.name || room.roomId || 'Room';

    const showRoomFallback = () => {
      if (activeRoomAvatar) {
        activeRoomAvatar.hidden = true;
        activeRoomAvatar.removeAttribute('src');
      }
      if (activeRoomAvatarFallback) {
        activeRoomAvatarFallback.hidden = false;
        activeRoomAvatarFallback.textContent = initials(room.name || room.roomId || '?');
      }
    };

    if (room.hasAvatar !== false && room.avatarUrl && activeRoomAvatar) {
      if (activeRoomAvatarFallback) activeRoomAvatarFallback.hidden = true;
      activeRoomAvatar.hidden = false;
      activeRoomAvatar.onerror = () => {
        activeRoomAvatar.onerror = null;
        showRoomFallback();
      };
      activeRoomAvatar.src = room.avatarUrl;
    } else {
      showRoomFallback();
    }

    const pinnedCount = Number(room.pinnedCount) || 0;
    if (roomPinsBadge) {
      roomPinsBadge.hidden = pinnedCount <= 0;
      roomPinsBadge.textContent = pinnedCount > 99 ? '99+' : String(pinnedCount);
    }
    if (roomSearchBtn) {
      roomSearchBtn.hidden = false;
    }
  }

  function isMobileUi() {
    try {
      if (mobileDrawerMq) return mobileDrawerMq.matches;
      return window.matchMedia('(max-width: 720px)').matches;
    } catch {
      return false;
    }
  }

  function syncMobileNavOverlay() {
    if (!chatView || !mobileNavOverlay) return;
    const rightOpen =
      isMobileUi() &&
      Boolean(activeRoomId) &&
      (membersPanelOpen || sharedMediaOpen);
    const show = (isMobileUi() && roomsDrawerOpen) || rightOpen;
    mobileNavOverlay.hidden = !show;
    chatView.classList.toggle('is-rooms-open', isMobileUi() && roomsDrawerOpen);
    chatView.classList.toggle('is-right-drawer-open', rightOpen);
    if (mobileRoomsBtn) {
      mobileRoomsBtn.classList.toggle('is-active', isMobileUi() && roomsDrawerOpen);
      mobileRoomsBtn.setAttribute('aria-expanded', roomsDrawerOpen && isMobileUi() ? 'true' : 'false');
      mobileRoomsBtn.title = roomsDrawerOpen ? 'Close rooms' : 'Rooms';
      mobileRoomsBtn.setAttribute('aria-label', roomsDrawerOpen ? 'Close rooms' : 'Open rooms');
    }
    // Keep Jump to latest from flashing under the drawer / dim overlay
    updateJumpToLatestBtn();
  }

  function setRoomsDrawerOpen(open) {
    roomsDrawerOpen = Boolean(open);
    if (roomsDrawerOpen && isMobileUi()) {
      // Exclusive with right drawers on phone
      if (membersPanelOpen || sharedMediaOpen) {
        membersPanelOpen = false;
        sharedMediaOpen = false;
        localStorage.setItem('relay.membersDrawer', '0');
        updateChatStageDrawers();
        return;
      }
    }
    syncMobileNavOverlay();
  }

  function updateChatStageDrawers() {
    const showMembers = membersPanelOpen && Boolean(activeRoomId);
    const showMedia = sharedMediaOpen && Boolean(activeRoomId);
    const mobile = isMobileUi();
    if (chatStage) {
      chatStage.classList.toggle('has-members', showMembers && !mobile);
      chatStage.classList.toggle('has-media', showMedia && !mobile);
    }
    if (roomMembersPanel) {
      if (mobile) {
        roomMembersPanel.hidden = false;
        roomMembersPanel.classList.toggle('is-mobile-open', showMembers);
        roomMembersPanel.setAttribute('aria-hidden', showMembers ? 'false' : 'true');
        if (!showMembers) roomMembersPanel.setAttribute('inert', '');
        else roomMembersPanel.removeAttribute('inert');
      } else {
        roomMembersPanel.hidden = !showMembers;
        roomMembersPanel.classList.remove('is-mobile-open');
        roomMembersPanel.removeAttribute('aria-hidden');
        roomMembersPanel.removeAttribute('inert');
      }
    }
    if (sharedMediaPanel) {
      if (mobile) {
        sharedMediaPanel.hidden = false;
        sharedMediaPanel.classList.toggle('is-mobile-open', showMedia);
        sharedMediaPanel.setAttribute('aria-hidden', showMedia ? 'false' : 'true');
        if (!showMedia) sharedMediaPanel.setAttribute('inert', '');
        else sharedMediaPanel.removeAttribute('inert');
      } else {
        sharedMediaPanel.hidden = !showMedia;
        sharedMediaPanel.classList.remove('is-mobile-open');
        sharedMediaPanel.removeAttribute('aria-hidden');
        sharedMediaPanel.removeAttribute('inert');
      }
    }
    if (roomMembersBtn) {
      roomMembersBtn.classList.toggle('is-active', showMembers);
      roomMembersBtn.setAttribute('aria-pressed', showMembers ? 'true' : 'false');
      roomMembersBtn.title = showMembers ? 'Hide members' : 'Show members';
    }
    if (roomMediaBtn) {
      roomMediaBtn.classList.toggle('is-active', showMedia);
      roomMediaBtn.setAttribute('aria-pressed', showMedia ? 'true' : 'false');
      roomMediaBtn.title = showMedia ? 'Hide Shared Media' : 'Shared Media';
    }
    if (showMembers || showMedia) roomsDrawerOpen = false;
    syncMobileNavOverlay();
  }

  function setMembersPanelOpen(open) {
    membersPanelOpen = Boolean(open);
    localStorage.setItem('relay.membersDrawer', membersPanelOpen ? '1' : '0');
    if (membersPanelOpen) {
      sharedMediaOpen = false;
      if (isMobileUi()) roomsDrawerOpen = false;
    }
    updateChatStageDrawers();
    if (membersPanelOpen && activeRoomId) {
      void refreshRoomMembers(activeRoomId);
    } else if (!activeRoomId && roomMembersList) {
      roomMembersCache = [];
      roomMembersList.innerHTML = '';
      if (roomMembersTitle) roomMembersTitle.textContent = 'Members';
    }
  }

  function setSharedMediaOpen(open) {
    sharedMediaOpen = Boolean(open);
    if (sharedMediaOpen) {
      membersPanelOpen = false;
      localStorage.setItem('relay.membersDrawer', '0');
      if (isMobileUi()) roomsDrawerOpen = false;
    }
    updateChatStageDrawers();
    if (sharedMediaOpen && activeRoomId) {
      void refreshSharedMedia(activeRoomId);
    } else if (!sharedMediaOpen) {
      sharedMediaItems = [];
      sharedMediaSenderFilter = new Set();
      sharedMediaRoomId = null;
      if (sharedMediaFilters) {
        sharedMediaFilters.hidden = true;
        sharedMediaFilters.innerHTML = '';
      }
      if (sharedMediaBody) sharedMediaBody.innerHTML = '';
    }
  }

  function renderRoomMembers(filterText = '') {
    if (!roomMembersList) return;
    const q = String(filterText || '').trim().toLowerCase();
    const members = roomMembersCache.filter((entry) => {
      if (!q) return true;
      const name = String(entry.displayName || '').toLowerCase();
      const id = String(entry.userId || '').toLowerCase();
      return name.includes(q) || id.includes(q);
    });

    roomMembersList.innerHTML = '';
    if (roomMembersTitle) {
      const count = roomMembersCache.length;
      roomMembersTitle.textContent = `${count} Member${count === 1 ? '' : 's'}`;
      roomMembersTitle.title = `${count} members`;
    }

    if (!members.length) {
      const empty = document.createElement('li');
      empty.className = 'room-members-empty';
      empty.textContent = q ? 'No matches' : 'No members';
      roomMembersList.appendChild(empty);
      return;
    }

    for (const member of members) {
      const li = document.createElement('li');
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'room-member-row';
      row.title = member.userId;

      if (member.hasAvatar !== false && member.avatarUrl) {
        const img = document.createElement('img');
        img.className = 'room-member-avatar';
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.decoding = 'async';
        img.addEventListener(
          'error',
          () => {
            const fallback = document.createElement('span');
            fallback.className = 'room-member-fallback';
            fallback.textContent = initials(member.displayName || member.userId);
            img.replaceWith(fallback);
          },
          { once: true },
        );
        img.src = member.avatarUrl;
        row.appendChild(img);
      } else {
        const fallback = document.createElement('span');
        fallback.className = 'room-member-fallback';
        fallback.textContent = initials(member.displayName || member.userId);
        row.appendChild(fallback);
      }

      const meta = document.createElement('div');
      meta.className = 'room-member-meta';
      const name = document.createElement('span');
      name.className = 'room-member-name';
      name.textContent = member.displayName || member.userId;
      meta.appendChild(name);
      if (member.role) {
        const role = document.createElement('span');
        role.className = 'room-member-role';
        role.textContent = member.role;
        meta.appendChild(role);
      }
      row.appendChild(meta);

      const presence = document.createElement('span');
      presence.className = 'room-member-presence';
      if (member.presence === 'online' || member.online) {
        presence.classList.add('is-online');
      } else if (member.presence === 'unavailable') {
        presence.classList.add('is-unavailable');
      }
      presence.title = member.presence || (member.online ? 'online' : 'offline');
      row.appendChild(presence);

      row.addEventListener('click', (event) => {
        void showUserProfile(member.userId, event.clientX, event.clientY);
      });
      row.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        if (!activeRoomId || !member.userId) return;
        const selfId = sessionUserId;
        if (selfId && member.userId === selfId) return;
        const choice = window.prompt(
          `Moderate ${member.displayName || member.userId}\nType kick or ban (leave blank to cancel)`,
          'kick',
        );
        if (!choice) return;
        const action = String(choice).trim().toLowerCase();
        if (action !== 'kick' && action !== 'ban') return;
        const reason = window.prompt('Reason (optional)', '') || '';
        void api(
          `/api/rooms/${encodeURIComponent(activeRoomId)}/members/${encodeURIComponent(member.userId)}/moderate`,
          {
            method: 'POST',
            body: JSON.stringify({ action, reason }),
          },
        )
          .then(() => refreshRoomMembers(activeRoomId))
          .catch((error) => {
            window.alert((error.message || String(error)).replace(/^MatrixError:\s*/i, ''));
          });
      });
      li.appendChild(row);
      roomMembersList.appendChild(li);
    }
  }

  async function refreshRoomMembers(roomId) {
    if (!roomId || !membersPanelOpen) return;
    try {
      const data = await api(`/api/rooms/${encodeURIComponent(roomId)}/members`);
      roomMembersCache = Array.isArray(data.members) ? data.members : [];
      if (typeof data.pinnedCount === 'number' && roomPinsBadge) {
        roomPinsBadge.hidden = data.pinnedCount <= 0;
        roomPinsBadge.textContent =
          data.pinnedCount > 99 ? '99+' : String(data.pinnedCount);
      }
      renderRoomMembers(roomMembersFilter?.value || '');
    } catch {
      roomMembersCache = [];
      renderRoomMembers(roomMembersFilter?.value || '');
    }
  }

  function setRoomSearchOpen(open) {
    if (open) openMessageSearch();
    else closeMessageSearch();
  }

  function messageSearchEmptyHtml() {
    return `
      <div class="message-search-empty">
        <svg viewBox="0 0 24 24" width="48" height="48" aria-hidden="true">
          <path fill="none" stroke="currentColor" stroke-width="1.5" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
        <h3>Search Messages</h3>
        <p>Find helpful messages in your community by searching with related keywords.</p>
      </div>
    `;
  }

  function syncMessageSearchFilters() {
    messageSearchFilterDms?.classList.toggle('is-active', messageSearchScope === 'dms');
    messageSearchFilterGlobal?.classList.toggle('is-active', messageSearchScope === 'global');
    if (messageSearchRoomChip) {
      const showRoom = messageSearchScope === 'room' && Boolean(messageSearchRoomId);
      messageSearchRoomChip.hidden = !showRoom;
      messageSearchRoomChip.classList.toggle('is-active', showRoom);
      if (showRoom && messageSearchRoomChipLabel) {
        const room = roomCatalog.find((entry) => entry.roomId === messageSearchRoomId);
        messageSearchRoomChipLabel.textContent = room?.name || messageSearchRoomId || 'Room';
      }
    }
  }

  function resolveSearchRoomIds() {
    if (messageSearchScope === 'room' && messageSearchRoomId) return [messageSearchRoomId];
    if (messageSearchScope === 'dms') {
      return roomCatalog.filter((room) => room.isDirect).map((room) => room.roomId);
    }
    return null;
  }

  function openMessageSearch() {
    if (settingsOpen) closeSettings();
    closeCreateChat();
    closeLobby();
    closeForum();
    hideRoomPinsPanel();
    messageSearchOpen = true;
    messageSearchRoomId = activeRoomId || null;
    messageSearchScope = messageSearchRoomId
      ? 'room'
      : activeSpaceFilter === 'dms'
        ? 'dms'
        : 'global';
    syncMessageSearchFilters();
    if (messageSearchResults) messageSearchResults.innerHTML = messageSearchEmptyHtml();
    chatMain.hidden = true;
    if (messageSearchView) messageSearchView.hidden = false;
    roomSearchBtn?.classList.add('is-active');
    roomSearchBtn?.setAttribute('aria-expanded', 'true');
    syncDmRailNavActive();
    syncSpaceRailNavActive();
    window.setTimeout(() => {
      messageSearchInput?.focus();
      messageSearchInput?.select?.();
    }, 30);
  }

  function closeMessageSearch() {
    messageSearchOpen = false;
    if (messageSearchView) messageSearchView.hidden = true;
    if (!settingsOpen) chatMain.hidden = false;
    roomSearchBtn?.classList.remove('is-active');
    roomSearchBtn?.setAttribute('aria-expanded', 'false');
    syncDmRailNavActive();
    syncSpaceRailNavActive();
  }

  async function runMessageSearch() {
    if (!messageSearchResults) return;
    const term = String(messageSearchInput?.value || '').trim();
    if (!term) {
      messageSearchResults.innerHTML = messageSearchEmptyHtml();
      return;
    }
    messageSearchResults.innerHTML = `<div class="message-search-status">Searching…</div>`;
    if (messageSearchEnter) messageSearchEnter.disabled = true;
    try {
      let roomIds = resolveSearchRoomIds();
      if (messageSearchScope === 'dms' && (!roomIds || roomIds.length === 0)) {
        await refreshRooms();
        roomIds = resolveSearchRoomIds();
      }
      const data = await api('/api/search/messages', {
        method: 'POST',
        body: JSON.stringify({ term, roomIds, limit: 40 }),
      });
      const results = Array.isArray(data.results) ? data.results : [];
      messageSearchResults.innerHTML = '';
      if (!results.length) {
        messageSearchResults.innerHTML = `<div class="message-search-status">No messages found for “${term}”.</div>`;
        return;
      }
      for (const hit of results) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'message-search-hit';
        if (hit.hasSenderAvatar !== false && hit.senderAvatarUrl) {
          const img = document.createElement('img');
          img.className = 'message-search-hit-avatar';
          img.alt = '';
          img.referrerPolicy = 'no-referrer';
          img.src = hit.senderAvatarUrl;
          img.addEventListener(
            'error',
            () => {
              const fallback = document.createElement('span');
              fallback.className = 'message-search-hit-fallback';
              fallback.textContent = initials(hit.senderName || hit.sender || '?');
              img.replaceWith(fallback);
            },
            { once: true },
          );
          btn.appendChild(img);
        } else {
          const fallback = document.createElement('span');
          fallback.className = 'message-search-hit-fallback';
          fallback.textContent = initials(hit.senderName || hit.sender || '?');
          btn.appendChild(fallback);
        }
        const main = document.createElement('div');
        const meta = document.createElement('div');
        meta.className = 'message-search-hit-meta';
        const sender = document.createElement('span');
        sender.className = 'message-search-hit-sender';
        sender.textContent = hit.senderName || hit.sender || 'Unknown';
        applyUsernameStyle(sender, hit.senderStyle || senderStyleCache.get(hit.sender) || null, {
          fallbackColor: nameColorForUser(hit.sender),
        });
        meta.appendChild(sender);
        if (hit.roomName) {
          const room = document.createElement('span');
          room.className = 'message-search-hit-room';
          room.textContent = hit.roomName;
          meta.appendChild(room);
        }
        const when = document.createElement('span');
        when.className = 'message-search-hit-when';
        when.textContent = hit.ts
          ? new Date(hit.ts).toLocaleString(undefined, {
              month: 'numeric',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })
          : '';
        meta.appendChild(when);
        main.appendChild(meta);
        const body = document.createElement('div');
        body.className = 'message-search-hit-body';
        body.textContent = hit.encrypted ? '[encrypted]' : hit.body || '';
        main.appendChild(body);
        btn.appendChild(main);
        btn.addEventListener('click', () => void openSearchHit(hit));
        messageSearchResults.appendChild(btn);
      }
      void warmSenderStyles(
        results.map((hit) => ({ sender: hit.sender, senderStyle: hit.senderStyle })),
        messageSearchRoomId || activeRoomId,
        messageRefreshToken,
      );
    } catch (error) {
      messageSearchResults.innerHTML = `<div class="message-search-status">${error.message || 'Search failed'}</div>`;
    } finally {
      if (messageSearchEnter) messageSearchEnter.disabled = false;
    }
  }

  async function openSearchHit(hit) {
    if (!hit?.roomId) return;
    closeMessageSearch();
    if (hit.roomId !== activeRoomId) {
      const room = roomCatalog.find((entry) => entry.roomId === hit.roomId);
      activeRoomId = hit.roomId;
      persistLastRoom(hit.roomId);
      updateTimelineHead(room || { roomId: hit.roomId, name: hit.roomName || hit.roomId });
      composerForm.hidden = false;
      updateCallChrome();
      setMembersPanelOpen(membersPanelOpen);
      await refreshMessages(hit.roomId, { pinBottom: false });
      void refreshRooms();
    }
    await jumpToPinnedMessage(hit.eventId);
  }

  function hideRoomPinsPanel() {
    if (!roomPinsPanel) return;
    roomPinsPanel.hidden = true;
    roomPinsBtn?.classList.remove('is-active');
    roomPinsBtn?.setAttribute('aria-expanded', 'false');
  }

  function hideRoomThreadsPanel() {
    if (!roomThreadsPanel) return;
    roomThreadsPanel.hidden = true;
    roomThreadsBtn?.classList.remove('is-active');
    roomThreadsBtn?.setAttribute('aria-expanded', 'false');
  }

  function hideRoomHeaderPopovers({ except = null } = {}) {
    if (except !== 'pins') hideRoomPinsPanel();
    if (except !== 'threads') hideRoomThreadsPanel();
    if (except !== 'more') hideRoomMenu();
  }

  function positionHeaderPanel(panel, anchorBtn, preferredWidth = 440) {
    if (!panel || !anchorBtn || panel.hidden) return;
    const rect = anchorBtn.getBoundingClientRect();
    const width = Math.min(preferredWidth, window.innerWidth - 24);
    let left = rect.right - width;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    let top = rect.bottom + 8;
    panel.style.width = `${width}px`;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = 'auto';
    const panelRect = panel.getBoundingClientRect();
    if (panelRect.bottom > window.innerHeight - 12) {
      top = Math.max(12, rect.top - panelRect.height - 8);
      panel.style.top = `${top}px`;
    }
  }

  function positionRoomPinsPanel() {
    positionHeaderPanel(roomPinsPanel, roomPinsBtn, 440);
  }

  function positionRoomThreadsPanel() {
    positionHeaderPanel(roomThreadsPanel, roomThreadsBtn, 440);
  }

  function formatPinTimestamp(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  function updatePinsBadge(count) {
    const n = Number(count) || 0;
    if (!roomPinsBadge) return;
    roomPinsBadge.hidden = n <= 0;
    roomPinsBadge.textContent = n > 99 ? '99+' : String(n);
  }

  async function jumpToMessage(eventId, { missingMessage = 'That message is not in the loaded timeline yet.' } = {}) {
    if (!eventId || !activeRoomId) return false;
    const findTarget = () =>
      [...messageList.querySelectorAll('article.message[data-event-id]')].find(
        (el) => el.dataset.eventId === eventId,
      ) || null;
    let target = findTarget();
    if (!target) {
      await refreshMessages(activeRoomId, { pinBottom: false });
      target = findTarget();
    }
    if (!target) {
      if (missingMessage) window.alert(missingMessage);
      return false;
    }
    stickMessagesToBottom = false;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.classList.add('message--flash');
    window.setTimeout(() => target.classList.remove('message--flash'), 1600);
    updateJumpToLatestBtn();
    return true;
  }

  async function jumpToPinnedMessage(eventId) {
    hideRoomPinsPanel();
    return jumpToMessage(eventId, {
      missingMessage: 'That pinned message is not in the loaded timeline yet.',
    });
  }

  async function unpinMessage(eventId) {
    if (!activeRoomId || !eventId) return;
    try {
      const result = await api(
        `/api/rooms/${encodeURIComponent(activeRoomId)}/pins/${encodeURIComponent(eventId)}/unpin`,
        { method: 'POST', body: '{}' },
      );
      updatePinsBadge(result.pinnedCount);
      await renderRoomPins();
      void refreshRooms();
    } catch (error) {
      window.alert(error.message || String(error));
    }
  }

  async function renderRoomPins() {
    if (!roomPinsList || !activeRoomId) return;
    roomPinsList.innerHTML = `<div class="room-pins-empty">Loading…</div>`;
    try {
      const data = await api(`/api/rooms/${encodeURIComponent(activeRoomId)}/pins`);
      updatePinsBadge(data.pinnedCount);
      const pins = Array.isArray(data.pinned) ? data.pinned : [];
      roomPinsList.innerHTML = '';
      if (!pins.length) {
        const empty = document.createElement('div');
        empty.className = 'room-pins-empty';
        empty.textContent = 'No pinned messages';
        roomPinsList.appendChild(empty);
        return;
      }

      for (const pin of pins) {
        const card = document.createElement('article');
        card.className = 'room-pin-card';
        if (pin.sender) card.dataset.sender = pin.sender;
        if (pin.isMine) card.dataset.mine = '1';

        const head = document.createElement('div');
        head.className = 'room-pin-card-head';

        if (pin.hasSenderAvatar !== false && pin.senderAvatarUrl) {
          const img = document.createElement('img');
          img.className = 'room-pin-avatar';
          img.alt = '';
          img.referrerPolicy = 'no-referrer';
          img.decoding = 'async';
          img.addEventListener(
            'error',
            () => {
              const fallback = document.createElement('span');
              fallback.className = 'room-pin-avatar-fallback';
              fallback.textContent = initials(pin.senderName || pin.sender || '?');
              img.replaceWith(fallback);
            },
            { once: true },
          );
          img.src = pin.senderAvatarUrl;
          head.appendChild(img);
        } else {
          const fallback = document.createElement('span');
          fallback.className = 'room-pin-avatar-fallback';
          fallback.textContent = initials(pin.senderName || pin.sender || '?');
          head.appendChild(fallback);
        }

        const meta = document.createElement('div');
        meta.className = 'room-pin-meta';
        const nameplate = document.createElement('span');
        nameplate.className = 'sender-nameplate';
        const nameplateAsset = document.createElement('span');
        nameplateAsset.className = 'sender-nameplate-asset';
        nameplateAsset.setAttribute('aria-hidden', 'true');
        const senderBtn = document.createElement('button');
        senderBtn.type = 'button';
        senderBtn.className = 'sender room-pin-sender';
        senderBtn.textContent = pin.senderName || pin.sender || 'Unknown';
        nameplate.appendChild(nameplateAsset);
        nameplate.appendChild(senderBtn);
        meta.appendChild(nameplate);

        if (pin.sender && pin.senderStyle) {
          rememberSenderStyle(pin.sender, pin.senderStyle);
        }
        const senderStyle =
          (pin.sender ? senderStyleCache.get(pin.sender) : null) ||
          pin.senderStyle ||
          null;
        applyUsernameStyle(senderBtn, senderStyle, {
          fallbackColor: pin.isMine ? 'var(--lavender)' : nameColorForUser(pin.sender),
        });
        if (pin.sender) {
          senderBtn.addEventListener('click', (event) => {
            void showUserProfile(pin.sender, event.clientX, event.clientY);
          });
        }
        const when = document.createElement('span');
        when.className = 'room-pin-when';
        when.textContent = formatPinTimestamp(pin.ts);
        meta.appendChild(when);
        head.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'room-pin-actions';
        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'room-pin-open';
        openBtn.textContent = 'Open';
        openBtn.disabled = Boolean(pin.missing);
        openBtn.addEventListener('click', () => void jumpToPinnedMessage(pin.eventId));
        actions.appendChild(openBtn);
        if (pin.canUnpin) {
          const unpinBtn = document.createElement('button');
          unpinBtn.type = 'button';
          unpinBtn.className = 'room-pin-unpin';
          unpinBtn.title = 'Unpin';
          unpinBtn.setAttribute('aria-label', 'Unpin message');
          unpinBtn.textContent = '×';
          unpinBtn.addEventListener('click', () => void unpinMessage(pin.eventId));
          actions.appendChild(unpinBtn);
        }
        head.appendChild(actions);
        card.appendChild(head);

        const body = document.createElement('div');
        body.className = 'room-pin-body';
        if (pin.encrypted) {
          body.textContent = '[encrypted]';
        } else if (pin.msgtype === 'm.image' && pin.imageUrl) {
          const img = document.createElement('img');
          img.className = 'room-pin-image';
          img.src = pin.imageUrl;
          img.alt = pin.body || 'Pinned image';
          body.appendChild(img);
        } else if (pin.body) {
          let rendered = null;
          try {
            if (window.RelayMarkdown?.renderMessage) {
              rendered = await window.RelayMarkdown.renderMessage({
                body: pin.body,
                html: pin.html || '',
              });
            }
          } catch {
            rendered = null;
          }
          if (rendered) body.appendChild(rendered);
          else body.appendChild(linkifyText(pin.body));
          const previewUrls = Array.isArray(pin.urls) ? pin.urls : extractUrlsFromText(pin.body || '');
          if (previewUrls.length > 0) {
            const previews = document.createElement('div');
            previews.className = 'link-previews';
            body.appendChild(previews);
            void mountLinkPreviews(previews, previewUrls.slice(0, 2));
          }
        } else {
          body.textContent = pin.missing ? 'Pinned message is no longer available' : '';
        }
        card.appendChild(body);
        roomPinsList.appendChild(card);
      }
      positionRoomPinsPanel();
      void warmSenderStyles(
        pins.map((pin) => ({ sender: pin.sender, senderStyle: pin.senderStyle })),
        activeRoomId,
        messageRefreshToken,
      );
    } catch (error) {
      roomPinsList.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'room-pins-empty';
      empty.textContent = error.message || 'Could not load pins';
      roomPinsList.appendChild(empty);
    }
  }

  async function openRoomPinsPanel() {
    if (!activeRoomId || !roomPinsPanel) return;
    hideRoomHeaderPopovers({ except: 'pins' });
    roomPinsPanel.hidden = false;
    roomPinsBtn?.classList.add('is-active');
    roomPinsBtn?.setAttribute('aria-expanded', 'true');
    positionRoomPinsPanel();
    await renderRoomPins();
    positionRoomPinsPanel();
  }

  async function renderRoomThreads() {
    if (!roomThreadsList) return;
    roomThreadsList.innerHTML = '';
    if (!activeRoomId) {
      const empty = document.createElement('div');
      empty.className = 'room-pins-empty';
      empty.textContent = 'No threads in this room yet.';
      roomThreadsList.appendChild(empty);
      return;
    }
    const loading = document.createElement('div');
    loading.className = 'room-pins-empty';
    loading.textContent = 'Loading threads…';
    roomThreadsList.appendChild(loading);
    try {
      const data = await api(`/api/rooms/${encodeURIComponent(activeRoomId)}/threads`);
      if (!roomThreadsList) return;
      roomThreadsList.innerHTML = '';
      const threads = Array.isArray(data.threads) ? data.threads : [];
      if (!threads.length) {
        const empty = document.createElement('div');
        empty.className = 'room-pins-empty';
        empty.textContent = 'No threads in this room yet.';
        roomThreadsList.appendChild(empty);
        return;
      }
      for (const thread of threads) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'room-pins-item';
        const title = document.createElement('strong');
        title.textContent = thread.body || 'Thread';
        const meta = document.createElement('span');
        meta.className = 'room-pins-meta';
        const replies = Number(thread.replyCount) || 0;
        meta.textContent = `${thread.senderName || 'User'} · ${replies} ${replies === 1 ? 'reply' : 'replies'}`;
        btn.appendChild(title);
        btn.appendChild(meta);
        btn.addEventListener('click', () => {
          roomThreadsPanel.hidden = true;
          roomThreadsBtn?.classList.remove('is-active');
          void jumpToMessage(thread.rootEventId, {
            missingMessage: 'That thread root is not in the loaded timeline yet.',
          });
          setPendingReply(
            {
              eventId: thread.rootEventId,
              body: thread.body,
              senderName: thread.senderName,
              sender: thread.sender,
              roomId: activeRoomId,
            },
            { thread: true },
          );
        });
        roomThreadsList.appendChild(btn);
      }
    } catch (error) {
      roomThreadsList.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'room-pins-empty';
      empty.textContent = (error.message || String(error)).replace(/^MatrixError:\s*/i, '') || 'Could not load threads.';
      roomThreadsList.appendChild(empty);
    }
  }

  function openRoomThreadsPanel() {
    if (!activeRoomId || !roomThreadsPanel) return;
    hideRoomHeaderPopovers({ except: 'threads' });
    roomThreadsPanel.hidden = false;
    roomThreadsBtn?.classList.add('is-active');
    roomThreadsBtn?.setAttribute('aria-expanded', 'true');
    void renderRoomThreads();
    positionRoomThreadsPanel();
  }

  function shortSenderName(name, userId) {
    const raw = String(name || '').trim();
    if (raw) return raw.split(/[ :]/)[0] || raw;
    const id = String(userId || '');
    if (id.startsWith('@') && id.includes(':')) return id.slice(1).split(':')[0] || id;
    return id || 'User';
  }

  function sharedMediaDayLabel(ts) {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startThat = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    if (startThat === startToday) return 'Today';
    if (startThat === startToday - dayMs) return 'Yesterday';
    return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  }

  function sharedMediaMonthKey(ts) {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  function sharedMediaDayKey(ts) {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return 'unknown';
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  function filteredSharedMediaItems() {
    if (!sharedMediaSenderFilter.size) return sharedMediaItems;
    return sharedMediaItems.filter((item) => sharedMediaSenderFilter.has(item.sender));
  }

  function renderSharedMediaFilters() {
    if (!sharedMediaFilters) return;
    const senders = [];
    const seen = new Set();
    for (const item of sharedMediaItems) {
      if (!item.sender || seen.has(item.sender)) continue;
      seen.add(item.sender);
      senders.push({
        userId: item.sender,
        displayName: shortSenderName(item.senderName, item.sender),
        avatarUrl: item.senderAvatarUrl || null,
      });
    }
    sharedMediaFilters.innerHTML = '';
    if (senders.length < 2) {
      sharedMediaFilters.hidden = true;
      return;
    }
    sharedMediaFilters.hidden = false;
    for (const sender of senders) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'shared-media-chip';
      const active =
        sharedMediaSenderFilter.size === 0 || sharedMediaSenderFilter.has(sender.userId);
      chip.classList.toggle('is-active', active);
      chip.title = sender.userId;
      if (sender.avatarUrl) {
        const img = document.createElement('img');
        img.className = 'shared-media-chip-avatar';
        img.alt = '';
        img.src = sender.avatarUrl;
        chip.appendChild(img);
      } else {
        const fallback = document.createElement('span');
        fallback.className = 'shared-media-chip-fallback';
        fallback.textContent = initials(sender.displayName || sender.userId);
        chip.appendChild(fallback);
      }
      const name = document.createElement('span');
      name.className = 'shared-media-chip-name';
      name.textContent = sender.displayName;
      chip.appendChild(name);
      chip.addEventListener('click', () => {
        if (sharedMediaSenderFilter.size === 0) {
          sharedMediaSenderFilter = new Set(senders.map((entry) => entry.userId));
        }
        if (sharedMediaSenderFilter.has(sender.userId)) {
          sharedMediaSenderFilter.delete(sender.userId);
          if (sharedMediaSenderFilter.size === 0) {
            // keep at least one selected — fall back to all
            sharedMediaSenderFilter = new Set();
          }
        } else {
          sharedMediaSenderFilter.add(sender.userId);
        }
        if (sharedMediaSenderFilter.size === senders.length) {
          sharedMediaSenderFilter = new Set();
        }
        renderSharedMediaFilters();
        renderSharedMediaBody();
      });
      sharedMediaFilters.appendChild(chip);
    }
  }

  function renderSharedMediaBody() {
    if (!sharedMediaBody) return;
    sharedMediaBody.innerHTML = '';
    const items = filteredSharedMediaItems();
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'shared-media-empty';
      empty.textContent = sharedMediaItems.length
        ? 'No media from selected people.'
        : 'No shared media in this room yet.';
      sharedMediaBody.appendChild(empty);
      return;
    }

    let currentMonth = null;
    let currentDay = null;
    let grid = null;

    for (const item of items) {
      const month = sharedMediaMonthKey(item.ts);
      const dayKey = sharedMediaDayKey(item.ts);
      if (month !== currentMonth) {
        currentMonth = month;
        currentDay = null;
        const monthEl = document.createElement('div');
        monthEl.className = 'shared-media-month';
        monthEl.textContent = month;
        sharedMediaBody.appendChild(monthEl);
      }
      if (dayKey !== currentDay) {
        currentDay = dayKey;
        const dayEl = document.createElement('div');
        dayEl.className = 'shared-media-day';
        dayEl.textContent = sharedMediaDayLabel(item.ts);
        sharedMediaBody.appendChild(dayEl);
        grid = document.createElement('div');
        grid.className = 'shared-media-grid';
        sharedMediaBody.appendChild(grid);
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shared-media-item';
      btn.title = item.imageFilename || (item.kind === 'video' ? 'Video' : 'Image');
      if (item.imageUrl) {
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        img.src = mediaProxyUrl(item.imageUrl);
        btn.appendChild(img);
      }
      if (item.kind === 'video') {
        const play = document.createElement('span');
        play.className = 'shared-media-play';
        play.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
        btn.appendChild(play);
      }
      btn.addEventListener('click', () => {
        if (item.kind === 'video' && item.eventId) {
          void jumpToPinnedMessage(item.eventId);
          return;
        }
        openImageLightbox({
          imageUrl: item.imageUrl,
          imageFullUrl: item.imageFullUrl,
          imageMxc: item.imageMxc,
          imageFilename: item.imageFilename,
          imageInfo: item.imageInfo,
          imageSpoiler: item.imageSpoiler,
          body: item.imageFilename,
        });
      });
      grid?.appendChild(btn);
    }
  }

  async function refreshSharedMedia(roomId) {
    if (!roomId || !sharedMediaOpen) return;
    if (sharedMediaBody) {
      sharedMediaBody.innerHTML = '<div class="shared-media-empty">Loading…</div>';
    }
    try {
      const data = await api(`/api/rooms/${encodeURIComponent(roomId)}/media?limit=200`);
      if (!sharedMediaOpen || activeRoomId !== roomId) return;
      sharedMediaRoomId = roomId;
      sharedMediaItems = Array.isArray(data.items) ? data.items : [];
      const valid = new Set(sharedMediaItems.map((item) => item.sender).filter(Boolean));
      for (const id of [...sharedMediaSenderFilter]) {
        if (!valid.has(id)) sharedMediaSenderFilter.delete(id);
      }
      renderSharedMediaFilters();
      renderSharedMediaBody();
    } catch (error) {
      if (!sharedMediaBody) return;
      sharedMediaBody.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'shared-media-empty';
      empty.textContent = error.message || 'Failed to load shared media';
      sharedMediaBody.appendChild(empty);
    }
  }

  function formatCallDuration(totalSeconds) {
    const secs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }

  function stopCallTimer() {
    if (callTimerInterval) {
      clearInterval(callTimerInterval);
      callTimerInterval = null;
    }
    callStartedAt = null;
    if (callPanelTimer) callPanelTimer.textContent = '00:00';
  }

  function startCallTimer() {
    if (callTimerInterval) return;
    callStartedAt = Date.now();
    const tick = () => {
      if (!callPanelTimer || !callStartedAt) return;
      callPanelTimer.textContent = formatCallDuration((Date.now() - callStartedAt) / 1000);
    };
    tick();
    callTimerInterval = setInterval(tick, 1000);
  }

  function displayNameForUser(userId) {
    if (!userId || userId === 'peer') return voipPeerLabel || 'Peer';
    if (userId === sessionUserId) {
      return sessionUserId.slice(1).split(':')[0] || 'You';
    }
    const local = String(userId).startsWith('@')
      ? String(userId).slice(1).split(':')[0]
      : String(userId);
    return local || userId;
  }

  function avatarUrlForUser(userId) {
    if (!userId || userId === 'peer') return null;
    return `/api/profile-avatar?userId=${encodeURIComponent(userId)}&size=64`;
  }

  function expandSpeakingIds(ids) {
    const next = new Set();
    for (const id of ids || []) {
      if (!id) continue;
      next.add(id);
      if (id === 'peer') {
        const snap = window.RelayVoip?.getSnapshot?.();
        const room = roomCatalog.find((entry) => entry.roomId === snap?.roomId);
        if (room?.dmUserId) next.add(room.dmUserId);
        for (const member of callMemberCache || []) {
          if (member?.userId && member.userId !== sessionUserId) next.add(member.userId);
        }
      }
    }
    return next;
  }

  function setSpeakingUsers(ids) {
    const next = expandSpeakingIds(ids);
    let changed = next.size !== speakingUserIds.size;
    if (!changed) {
      for (const id of next) {
        if (!speakingUserIds.has(id)) {
          changed = true;
          break;
        }
      }
    }
    if (!changed) return;
    speakingUserIds = next;
    applySpeakingRings();
  }

  function applySpeakingRings() {
    document.querySelectorAll('[data-voice-user]').forEach((el) => {
      const id = el.getAttribute('data-voice-user');
      el.classList.toggle('is-speaking', Boolean(id && speakingUserIds.has(id)));
    });
  }

  function renderCallParticipants(snap) {
    if (!callParticipantList) return;
    const fromSnap = Array.isArray(snap?.participants) ? snap.participants : [];
    const fromMembers = Array.isArray(callMemberCache)
      ? callMemberCache.map((entry) => ({
          userId: entry.userId,
          self: entry.userId === sessionUserId,
          sharing: Boolean(snap?.isScreenSharing && entry.userId !== sessionUserId),
          speaking: speakingUserIds.has(entry.userId),
        }))
      : [];
    const merged = new Map();
    for (const entry of [...fromMembers, ...fromSnap]) {
      if (!entry?.userId) continue;
      merged.set(entry.userId, {
        userId: entry.userId,
        self: Boolean(entry.self || entry.userId === sessionUserId),
        sharing: Boolean(entry.sharing),
        speaking: Boolean(entry.speaking || speakingUserIds.has(entry.userId)),
      });
    }
    if (snap?.isScreenSharing) {
      for (const [userId, entry] of merged) {
        if (entry.self) entry.sharing = true;
        merged.set(userId, entry);
      }
    }
    const list = [...merged.values()];
    if (!list.length && snap?.roomId) {
      list.push({
        userId: sessionUserId || 'you',
        self: true,
        sharing: false,
        speaking: speakingUserIds.has(sessionUserId || 'you'),
      });
      list.push({
        userId: 'peer',
        self: false,
        sharing: Boolean(snap.isScreenSharing),
        speaking: speakingUserIds.has('peer'),
      });
    }

    callParticipantList.innerHTML = '';
    for (const entry of list) {
      const li = document.createElement('li');
      li.className = `call-participant${entry.speaking ? ' is-speaking' : ''}`;
      li.setAttribute('data-voice-user', entry.userId);

      const avatarUrl = avatarUrlForUser(entry.userId);
      if (avatarUrl) {
        const img = document.createElement('img');
        img.className = 'call-participant-avatar';
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.src = avatarUrl;
        img.addEventListener(
          'error',
          () => {
            const fallback = document.createElement('span');
            fallback.className = 'call-participant-fallback';
            fallback.textContent = initials(displayNameForUser(entry.userId));
            img.replaceWith(fallback);
          },
          { once: true },
        );
        li.appendChild(img);
      } else {
        const fallback = document.createElement('span');
        fallback.className = 'call-participant-fallback';
        fallback.textContent = initials(displayNameForUser(entry.userId));
        li.appendChild(fallback);
      }

      const meta = document.createElement('div');
      meta.className = 'call-participant-meta';
      const name = document.createElement('div');
      name.className = `call-participant-name${entry.self ? ' is-self' : ''}`;
      const label = displayNameForUser(entry.userId);
      name.textContent = entry.self ? `${label} (You)` : label;
      const idLine = document.createElement('div');
      idLine.className = 'call-participant-id';
      idLine.textContent = entry.userId === 'peer' ? '' : entry.userId;
      meta.appendChild(name);
      if (idLine.textContent) meta.appendChild(idLine);
      li.appendChild(meta);

      const badges = document.createElement('div');
      badges.className = 'call-participant-badges';
      if (entry.sharing) {
        const share = document.createElement('span');
        share.title = 'Sharing screen';
        share.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2h4v-2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>';
        badges.appendChild(share);
      }
      li.appendChild(badges);
      callParticipantList.appendChild(li);
    }

    if (callParticipantLabel) {
      callParticipantLabel.textContent = `${list.length} Participant${list.length === 1 ? '' : 's'}`;
    }
  }

  async function refreshCallMembers(roomId) {
    if (!roomId) {
      callMemberCache = [];
      return;
    }
    try {
      const data = await api(`/api/voip/livekit/members?roomId=${encodeURIComponent(roomId)}`);
      callMemberCache = Array.isArray(data.members) ? data.members : [];
    } catch {
      callMemberCache = [];
    }
  }

  function setPressed(btn, pressed) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  }

  function applyCallMediaMute(deafened) {
    if (remoteCallAudio) remoteCallAudio.muted = Boolean(deafened);
    if (remoteCallVideo) remoteCallVideo.muted = Boolean(deafened);
  }

  function updateCallChrome() {
    const voip = window.RelayVoip;
    const snap = voip?.getSnapshot?.() || { state: 'idle' };
    const inCall = snap.state && snap.state !== 'idle';
    const onActiveRoom = Boolean(activeRoomId);
    const mediaActive =
      inCall &&
      (snap.state === 'connected' ||
        snap.state === 'connecting' ||
        snap.state === 'invite_sent');

    timelineCallActions.hidden = !onActiveRoom;
    voiceCallBtn.hidden = inCall;
    videoCallBtn.hidden = inCall;
    hangupCallBtn.hidden = !inCall;

    if (!inCall) {
      callStatus.hidden = true;
      callStatus.textContent = '';
      callMediaDock.hidden = true;
      callMediaDock.classList.remove('is-screen-focus');
      incomingCallBanner.hidden = true;
      stopCallTimer();
      callMemberCache = [];
      setSpeakingUsers([]);
      if (callParticipantList) callParticipantList.innerHTML = '';
      if (remoteCallAudio) remoteCallAudio.srcObject = null;
      if (remoteCallVideo) remoteCallVideo.srcObject = null;
      if (localCallVideo) localCallVideo.srcObject = null;
      if (screenCallVideo) screenCallVideo.srcObject = null;
      if (callScreenFrame) callScreenFrame.hidden = true;
      setPressed(callMuteBtn, false);
      setPressed(callDeafenBtn, false);
      setPressed(callVideoToggleBtn, false);
      setPressed(callScreenBtn, false);
      return;
    }

    const peerName = roomLabel(snap.roomId) || voipPeerLabel || 'Call';
    const title =
      snap.state === 'connecting' || snap.state === 'invite_sent'
        ? `Connecting — ${peerName}`
        : `In Call — ${peerName}`;
    if (callPanelTitle) callPanelTitle.textContent = title;
    callStatus.hidden = true;
    callStatus.textContent = '';

    if (snap.state === 'ringing') {
      incomingCallBanner.hidden = false;
      incomingCallTitle.textContent = 'Incoming call';
      incomingCallMeta.textContent = roomLabel(snap.roomId);
      callMediaDock.hidden = true;
      if (!callRingingSoundActive) {
        callRingingSoundActive = true;
        playRelaySound('call');
      }
    } else {
      incomingCallBanner.hidden = true;
      callMediaDock.hidden = !mediaActive;
      if (callRingingSoundActive) {
        callRingingSoundActive = false;
        stopRelaySound('call');
      }
    }

    if (snap.state === 'connected') startCallTimer();
    else if (snap.state === 'connecting' || snap.state === 'invite_sent') {
      if (!callTimerInterval && callPanelTimer) callPanelTimer.textContent = '00:00';
    }

    setPressed(callMuteBtn, Boolean(snap.isMuted));
    setPressed(callDeafenBtn, Boolean(snap.isDeafened));
    setPressed(callVideoToggleBtn, Boolean(snap.isVideoEnabled));
    setPressed(callScreenBtn, Boolean(snap.isScreenSharing));
    applyCallMediaMute(snap.isDeafened);

    const showScreen = Boolean(screenCallVideo?.srcObject);
    callMediaDock.classList.toggle('is-screen-focus', showScreen);
    if (callScreenFrame) callScreenFrame.hidden = !showScreen;

    callParticipantsSection?.classList.toggle('is-collapsed', !callParticipantsOpen);
    callParticipantsToggle?.setAttribute('aria-expanded', callParticipantsOpen ? 'true' : 'false');
    renderCallParticipants(snap);
    if (snap.backend === 'livekit' && snap.roomId) {
      void refreshCallMembers(snap.roomId).then(() => renderCallParticipants(snap));
    }
  }

  function appendVoiceParticipants(parentLi, room) {
    const members = collectVoiceMembersForRoom(room);
    if (!members.length) return;

    const list = document.createElement('ul');
    list.className = 'room-voice-list';
    list.setAttribute('aria-label', 'In voice call');

    for (const entry of members) {
      const item = document.createElement('li');
      const speaking = speakingUserIds.has(entry.userId);
      item.className = `room-voice-item${speaking ? ' is-speaking' : ''}`;
      item.setAttribute('data-voice-user', entry.userId);
      item.title = entry.userId || entry.displayName;

      const showFallback = () => {
        item.querySelector('.room-voice-avatar')?.remove();
        if (item.querySelector('.room-voice-avatar-fallback')) return;
        const fallback = document.createElement('span');
        fallback.className = 'room-voice-avatar-fallback';
        fallback.textContent = initials(entry.displayName);
        const micEl = item.querySelector('.room-voice-mic');
        if (micEl) item.insertBefore(fallback, micEl);
        else item.prepend(fallback);
      };

      if (entry.hasAvatar !== false && entry.avatarUrl) {
        const img = document.createElement('img');
        img.className = 'room-voice-avatar';
        img.alt = '';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', showFallback, { once: true });
        img.src = entry.avatarUrl;
        item.appendChild(img);
      } else {
        const fallback = document.createElement('span');
        fallback.className = 'room-voice-avatar-fallback';
        fallback.textContent = initials(entry.displayName);
        item.appendChild(fallback);
      }

      const mic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      mic.setAttribute('class', 'room-voice-mic');
      mic.setAttribute('viewBox', '0 0 24 24');
      mic.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill', 'currentColor');
      path.setAttribute(
        'd',
        'M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2z',
      );
      mic.appendChild(path);
      item.appendChild(mic);

      const label = document.createElement('span');
      label.className = 'room-voice-name';
      label.textContent = entry.displayName;
      item.appendChild(label);
      list.appendChild(item);
    }

    parentLi.appendChild(list);
  }

  function collectVoiceMembersForRoom(room) {
    const byUser = new Map();
    const add = (entry) => {
      const userId = entry?.userId;
      if (!userId || byUser.has(userId)) return;
      byUser.set(userId, {
        userId,
        displayName: entry.displayName || displayNameForUser(userId),
        avatarUrl: entry.avatarUrl || avatarUrlForUser(userId),
        hasAvatar: entry.hasAvatar !== false,
      });
    };

    for (const entry of room.voiceMembers || []) add(entry);

    // Local call fallback when MSC3401 state hasn't landed yet (or 1:1 WebRTC).
    const voip = window.RelayVoip;
    const snap = voip?.getSnapshot?.();
    if (snap && snap.state !== 'idle' && snap.roomId === room.roomId) {
      if (sessionUserId) {
        add({
          userId: sessionUserId,
          displayName: displayNameForUser(sessionUserId),
          avatarUrl: avatarUrlForUser(sessionUserId),
        });
      }
      for (const entry of callMemberCache || []) add(entry);
      for (const entry of snap.participants || []) add(entry);
      if (room.isDirect && room.dmUserId) {
        add({
          userId: room.dmUserId,
          displayName: room.name || displayNameForUser(room.dmUserId),
          avatarUrl: avatarUrlForUser(room.dmUserId),
        });
      }
    }

    return [...byUser.values()];
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    stopLiveStream();
    stopTypingPoll();
    void sendTypingState(false);
  }

  function stopLiveStream() {
    liveStreamConnected = false;
    liveMessageRefreshRoomId = null;
    if (liveMessageRefreshTimer) {
      clearTimeout(liveMessageRefreshTimer);
      liveMessageRefreshTimer = 0;
    }
    if (liveRoomsRefreshTimer) {
      clearTimeout(liveRoomsRefreshTimer);
      liveRoomsRefreshTimer = 0;
    }
    if (liveReceiptRefreshTimer) {
      clearTimeout(liveReceiptRefreshTimer);
      liveReceiptRefreshTimer = 0;
    }
    if (liveEventSource) {
      try {
        liveEventSource.close();
      } catch {
        // ignore
      }
      liveEventSource = null;
    }
  }

  function scheduleLiveMessageRefresh(roomId) {
    if (!roomId || roomId !== activeRoomId) return;
    liveMessageRefreshRoomId = roomId;
    if (liveMessageRefreshTimer) clearTimeout(liveMessageRefreshTimer);
    liveMessageRefreshTimer = window.setTimeout(() => {
      liveMessageRefreshTimer = 0;
      const id = liveMessageRefreshRoomId;
      liveMessageRefreshRoomId = null;
      // Keep fingerprint so quiet refresh can no-op when nothing changed.
      if (id && activeRoomId === id) void refreshMessages(id, { quiet: true });
    }, 320);
  }

  function scheduleLiveReceiptRefresh(roomId) {
    if (!roomId || roomId !== activeRoomId) return;
    if (liveReceiptRefreshTimer) clearTimeout(liveReceiptRefreshTimer);
    liveReceiptRefreshTimer = window.setTimeout(() => {
      liveReceiptRefreshTimer = 0;
      // Receipts alone shouldn't nuke the whole timeline — fold into quiet refresh.
      if (activeRoomId === roomId) void refreshMessages(roomId, { quiet: true });
    }, 1200);
  }

  function scheduleLiveRoomsRefresh() {
    if (liveRoomsRefreshTimer) clearTimeout(liveRoomsRefreshTimer);
    liveRoomsRefreshTimer = window.setTimeout(() => {
      liveRoomsRefreshTimer = 0;
      void refreshRooms();
    }, 600);
  }

  function startLiveStream() {
    stopLiveStream();
    if (typeof EventSource === 'undefined') return;
    try {
      liveEventSource = new EventSource('/api/live');
    } catch {
      liveEventSource = null;
      return;
    }
    liveEventSource.addEventListener('ready', () => {
      liveStreamConnected = true;
    });
    liveEventSource.addEventListener('live', (event) => {
      let data = null;
      try {
        data = JSON.parse(event.data || '{}');
      } catch {
        return;
      }
      if (data?.kind === 'paarrot-control') {
        handlePaarrotControl(data);
        return;
      }
      if (data?.kind === 'session' && data.connected === false) {
        void confirmLoggedOut();
        return;
      }
      // First sync finished (or catch-up after restart) — force a full timeline reload.
      if (data?.kind === 'sync') {
        void refreshSpaces();
        void refreshRooms();
        if (activeRoomId) {
          void refreshMessages(activeRoomId, { quiet: false, pinBottom: true });
        }
        return;
      }
      if (data?.kind === 'emoji-confetti') {
        if (data.roomId && data.roomId === activeRoomId) {
          playRemoteEmojiConfetti({
            emojis: data.emojis,
            targetEventId: data.targetEventId,
            sender: data.sender,
          });
        }
        return;
      }
      if (!data?.roomId || data.live === false) return;

      if (data.kind === 'receipt') {
        scheduleLiveReceiptRefresh(data.roomId);
        return;
      }

      if (data.kind !== 'timeline') return;
      const type = String(data.type || '');
      if (type === 'app.relay.emoji_confetti') return;
      const interesting =
        type === 'm.room.message' ||
        type === 'm.room.encrypted' ||
        type === 'm.room.redaction' ||
        type === 'm.reaction' ||
        data.decrypted;
      if (!interesting) return;

      if (data.roomId === activeRoomId) scheduleLiveMessageRefresh(data.roomId);
      if (
        type === 'm.room.message' ||
        type === 'm.room.encrypted' ||
        type === 'm.room.redaction'
      ) {
        scheduleLiveRoomsRefresh();
      }
    });
    liveEventSource.onerror = () => {
      liveStreamConnected = false;
    };
  }

  function startPolling() {
    stopPolling();
    void refreshSpaces();
    void refreshRooms();
    void refreshInvites();
    void refreshAccountChip();
    void pollActivity({ bootstrap: true });
    startLiveStream();
    let pollTick = 0;
    pollTimer = setInterval(() => {
      pollTick += 1;
      void refreshSpaces();
      void refreshRooms();
      void refreshInvites();
      void refreshAccountChip();
      void pollActivity();
      if (pollTick % 3 === 0) void refreshSecurityBadge();
      if (!activeRoomId) return;
      // Live SSE handles snappy updates; poll is a slower safety net when connected.
      if (!liveStreamConnected || pollTick % 4 === 0) {
        void refreshMessages(activeRoomId, { quiet: true });
      }
    }, 5000);
    startTypingPoll();
  }

  function stopTypingPoll() {
    if (typingPollTimer) {
      clearInterval(typingPollTimer);
      typingPollTimer = null;
    }
  }

  function startTypingPoll() {
    stopTypingPoll();
    void refreshTypingIndicator();
    typingPollTimer = setInterval(() => {
      void refreshTypingIndicator();
    }, 2000);
  }

  function formatTypingLabel(users) {
    const names = users.map((entry) => entry.displayName || displayNameForUser(entry.userId));
    if (names.length === 0) return '';
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return `${names[0]} and ${names.length - 1} others are typing…`;
  }

  async function refreshTypingIndicator() {
    if (!typingIndicator) return;
    if (!activeRoomId || composerForm.hidden) {
      typingIndicator.hidden = true;
      typingIndicator.replaceChildren();
      lastTypingFingerprint = '';
      return;
    }
    try {
      const data = await api(`/api/rooms/${encodeURIComponent(activeRoomId)}/typing`);
      const users = Array.isArray(data.users) ? data.users : [];
      const fingerprint = users.map((entry) => entry.userId).join(',');
      lastTypingFingerprint = fingerprint;
      if (users.length === 0) {
        typingIndicator.hidden = true;
        typingIndicator.replaceChildren();
        return;
      }

      typingIndicator.hidden = false;
      typingIndicator.replaceChildren();

      const avatars = document.createElement('div');
      avatars.className = 'typing-indicator-avatars';
      for (const user of users.slice(0, 3)) {
        if (user.hasAvatar !== false && user.avatarUrl) {
          const img = document.createElement('img');
          img.className = 'typing-indicator-avatar';
          img.alt = '';
          img.referrerPolicy = 'no-referrer';
          img.src = user.avatarUrl;
          img.addEventListener(
            'error',
            () => {
              const fallback = document.createElement('span');
              fallback.className = 'typing-indicator-fallback';
              fallback.textContent = initials(user.displayName || user.userId || '?');
              img.replaceWith(fallback);
            },
            { once: true },
          );
          avatars.appendChild(img);
        } else {
          const fallback = document.createElement('span');
          fallback.className = 'typing-indicator-fallback';
          fallback.textContent = initials(user.displayName || user.userId || '?');
          avatars.appendChild(fallback);
        }
      }
      typingIndicator.appendChild(avatars);

      const dots = document.createElement('span');
      dots.className = 'typing-indicator-dots';
      dots.setAttribute('aria-hidden', 'true');
      dots.innerHTML = '<span></span><span></span><span></span>';
      typingIndicator.appendChild(dots);

      const label = document.createElement('span');
      label.textContent = formatTypingLabel(users);
      typingIndicator.appendChild(label);
    } catch {
      // ignore while logged out / room switch
    }
  }

  async function sendTypingState(typing) {
    if (!activeRoomId) return;
    if (hideActivityEnabled()) {
      if (localTypingSent) {
        localTypingSent = false;
        try {
          await api(`/api/rooms/${encodeURIComponent(activeRoomId)}/typing`, {
            method: 'POST',
            body: JSON.stringify({ typing: false, timeoutMs: 20000 }),
          });
        } catch {
          // ignore
        }
      }
      return;
    }
    const next = Boolean(typing);
    if (!next && !localTypingSent) return;
    if (next && localTypingSent && Date.now() - lastTypingSentAt < 8000) return;
    try {
      await api(`/api/rooms/${encodeURIComponent(activeRoomId)}/typing`, {
        method: 'POST',
        body: JSON.stringify({ typing: next, timeoutMs: 20000 }),
      });
      localTypingSent = next;
      lastTypingSentAt = Date.now();
      if (!next) lastTypingSentAt = 0;
    } catch {
      // ignore
    }
  }

  function bumpLocalTyping() {
    if (!activeRoomId || composerForm.hidden) return;
    const hasText = Boolean(String(composerInput.value || '').trim());
    if (!hasText) {
      if (typingIdleTimer) {
        clearTimeout(typingIdleTimer);
        typingIdleTimer = null;
      }
      void sendTypingState(false);
      return;
    }
    void sendTypingState(true);
    if (typingIdleTimer) clearTimeout(typingIdleTimer);
    typingIdleTimer = setTimeout(() => {
      typingIdleTimer = null;
      void sendTypingState(false);
    }, 4000);
  }

  async function markActiveRoomRead(roomId = activeRoomId) {
    if (!roomId) return;
    clearRoomNotifications(roomId);
    const room = roomCatalog.find((entry) => entry.roomId === roomId);
    const hadUnread = (room?.unread || 0) > 0;
    if (room) room.unread = 0;
    if (hadUnread) void refreshRooms();
    if (hideActivityEnabled()) return;
    try {
      await api(`/api/rooms/${encodeURIComponent(roomId)}/read`, {
        method: 'POST',
        body: '{}',
      });
    } catch {
      // ignore
    }
  }

  async function refreshAccountChip() {
    try {
      const session = await api('/api/session');
      if (session.connected) updateAccountAvatar(session);
    } catch {
      // ignore
    }
  }

  function setLoginError(message) {
    if (!message) {
      loginError.hidden = true;
      loginError.textContent = '';
      return;
    }
    loginError.hidden = false;
    loginError.textContent = message;
  }

  async function api(path, options) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || res.statusText || 'Request failed');
    }
    return data;
  }

  async function bootstrap() {
    if (window.__kitsuStandaloneReady) {
      try { await window.__kitsuStandaloneReady; } catch (_) {}
    }
    try {
      const rememberedHs = localStorage.getItem('relay.homeserver');
      const rememberedUser = localStorage.getItem('relay.user');
      if (rememberedHs && homeserverInput) homeserverInput.value = rememberedHs;
      if (rememberedUser && userInput) userInput.value = rememberedUser;

      try {
        loadTwitterEmojiSetting();
        loadNotificationSettings();
        loadGeneralPrefs();
        loadAppearancePrefs();
        applyMessageLayoutPrefs();
      } catch (error) {
        console.warn('[relay] pref boot failed', error);
      }
      if (typeof window.matchMedia === 'function') {
        const mq = window.matchMedia('(prefers-color-scheme: light)');
        const onScheme = () => {
          if (systemThemeEnabled()) refreshActiveTheme();
        };
        if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onScheme);
        else if (typeof mq.addListener === 'function') mq.addListener(onScheme);
      }

      // Session first — themes / stickers load after UI is up.
      let session = null;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        try {
          session = await api('/api/session');
          if (session?.connected) break;
        } catch (error) {
          console.warn('[relay] session poll', attempt, error?.message || error);
        }
        await new Promise((resolve) => setTimeout(resolve, attempt < 10 ? 50 : 120));
      }

      if (session?.connected) {
        showChat(session);
        void refreshEmojiStickerSettings();
        void loadThemes().catch(() => {});
        // Heavy vendor bundles after chat chrome is visible.
        void ensureMarkdown().catch(() => {});
        void ensureLiveKit().catch(() => {});
        // Wait for Matrix client sync (PREPARED) before first room fetch.
        // Server can take up to ~45s on first sync after restart.
        for (let attempt = 0; attempt < 300; attempt += 1) {
          try {
            const live = await api('/api/session');
            if (live?.ready) {
              session = live;
              break;
            }
            // Restore finished without a live client — don't sit on empty chat forever.
            if (live && !live.connected && !live.restoring) {
              session = live;
              break;
            }
            if (live?.connected) session = live;
          } catch {
            // keep waiting
          }
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
        if (!session?.ready) {
          console.warn('[relay] session never became ready', session?.error || '');
          showLogin('bootstrap:restore-failed');
          if (loginError && session?.error) {
            setLoginError(`Session restore failed: ${session.error}`);
          }
          void refreshEmojiStickerSettings();
          void loadThemes().catch(() => {});
          return;
        }
        if (session?.userId && session.userId !== sessionUserId) {
          showChat(session);
        }
        try {
          await loadSidebarLayout();
          await refreshSpaces();
          // Match DM-tab behaviour: land on Direct Messages and open the first chat.
          await setSpaceFilter('dms');
          didRestoreLastRoom = true;
        } catch (error) {
          console.warn('[relay] post-login room refresh failed', error);
        }
      } else {
        showLogin('bootstrap:no-session');
        void refreshEmojiStickerSettings();
        void loadThemes().catch(() => {});
      }
    } catch (error) {
      console.error('[relay] bootstrap failed', error);
      try {
        const session = await api('/api/session');
        if (session?.connected) showChat(session);
        else showLogin('bootstrap:fatal-no-session');
      } catch {
        showLogin('bootstrap:fatal');
      }
    }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setLoginError('');
    loginBtn.disabled = true;

    const homeserver = homeserverInput.value.trim();
    const user = userInput.value.trim();
    const password = document.getElementById('password').value;

    localStorage.setItem('relay.homeserver', homeserver);
    localStorage.setItem('relay.user', user);

    try {
      const session = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ homeserver, user, password }),
      });
      document.getElementById('password').value = '';
      showChat(session);
      await loadSidebarLayout();
      await refreshSpaces();
      await setSpaceFilter('dms');
      didRestoreLastRoom = true;
    } catch (error) {
      setLoginError(error.message || String(error));
    } finally {
      loginBtn.disabled = false;
    }
  });

  function spaceLabel(filter) {
    if (filter === 'home') return 'All rooms';
    if (filter === 'dms') return 'Direct Messages';
    const space = spaceCatalog.find((entry) => entry.spaceId === filter);
    if (space?.name) return space.name;
    const cached = spaceNameCache.get(filter);
    if (cached) return cached;
    return 'Space';
  }

  function syncSpaceFilterHeading() {
    if (spaceFilterLabel) spaceFilterLabel.textContent = spaceLabel(activeSpaceFilter);
  }

  function initials(name) {
    const parts = String(name || '?')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function roomJoinRuleIconSvg(joinRule) {
    const rule = String(joinRule || 'restricted').toLowerCase();
    if (rule === 'public') {
      return '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/><path d="M4 9h16M4 15h16"/>';
    }
    if (rule === 'invite' || rule === 'knock' || rule === 'private') {
      return '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/><rect x="15.5" y="11" width="6" height="5" rx="1"/><path d="M17 11V9.5a1.5 1.5 0 0 1 3 0V11"/>';
    }
    return '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>';
  }

  let quickSwitchItems = [];
  let quickSwitchIndex = 0;
  let quickSwitchRoomsCache = [];

  function matrixDomainFromId(id) {
    const value = String(id || '');
    const idx = value.lastIndexOf(':');
    return idx >= 0 ? value.slice(idx + 1) : '';
  }

  function matrixLocalpart(id) {
    const value = String(id || '');
    if (value.startsWith('@') || value.startsWith('#') || value.startsWith('!')) {
      const body = value.slice(1);
      const idx = body.indexOf(':');
      return idx >= 0 ? body.slice(0, idx) : body;
    }
    return value;
  }

  function isQuickSwitcherOpen() {
    return Boolean(quickSwitcher?.open);
  }

  function closeQuickSwitcher() {
    if (!quickSwitcher) return;
    if (quickSwitcher.open) quickSwitcher.close();
    railSearchBtn?.classList.remove('is-active');
    if (quickSwitcherInput) quickSwitcherInput.value = '';
    quickSwitchItems = [];
    quickSwitchIndex = 0;
    if (quickSwitcherResults) quickSwitcherResults.innerHTML = '';
  }

  function buildQuickSwitchEntries(rooms) {
    const entries = [];
    for (const space of orderedVisibleSpaces(spaceCatalog)) {
      entries.push({
        kind: 'space',
        id: space.spaceId,
        name: space.name || space.spaceId,
        handle: `*${matrixLocalpart(space.spaceId) || 'space'}`,
        domain: matrixDomainFromId(space.spaceId),
        avatarUrl: space.avatarUrl,
        hasAvatar: space.hasAvatar,
        sortTs: 0,
      });
    }
    for (const room of rooms || []) {
      if (!room?.roomId) continue;
      const isDirect = Boolean(room.isDirect);
      const handleSource = isDirect ? room.dmUserId || room.roomId : room.alias || room.roomId;
      entries.push({
        kind: isDirect ? 'dm' : 'room',
        id: room.roomId,
        roomId: room.roomId,
        name: room.name || room.roomId,
        handle: isDirect
          ? `@${matrixLocalpart(handleSource)}`
          : room.alias
            ? room.alias
            : `#${matrixLocalpart(handleSource)}`,
        domain: matrixDomainFromId(isDirect ? room.dmUserId || room.roomId : room.alias || room.roomId),
        avatarUrl: room.avatarUrl,
        hasAvatar: room.hasAvatar,
        isDirect,
        dmUserId: room.dmUserId || null,
        encrypted: Boolean(room.encrypted),
        sortTs: Number(room.lastEventTs) || 0,
      });
    }
    return entries;
  }

  function parseQuickSwitchQuery(raw) {
    const trimmed = String(raw || '').trim();
    if (trimmed.startsWith('#')) return { mode: 'room', query: trimmed.slice(1).trim().toLowerCase() };
    if (trimmed.startsWith('@')) return { mode: 'dm', query: trimmed.slice(1).trim().toLowerCase() };
    if (trimmed.startsWith('*')) return { mode: 'space', query: trimmed.slice(1).trim().toLowerCase() };
    return { mode: 'all', query: trimmed.toLowerCase() };
  }

  function filterQuickSwitchEntries(entries, rawQuery) {
    const { mode, query } = parseQuickSwitchQuery(rawQuery);
    let list = entries;
    if (mode === 'room') list = entries.filter((entry) => entry.kind === 'room');
    else if (mode === 'dm') list = entries.filter((entry) => entry.kind === 'dm');
    else if (mode === 'space') list = entries.filter((entry) => entry.kind === 'space');

    if (query) {
      list = list.filter((entry) => {
        const hay = `${entry.name} ${entry.handle} ${entry.domain} ${entry.id}`.toLowerCase();
        return hay.includes(query);
      });
    }

    return list
      .slice()
      .sort((a, b) => {
        if (query) {
          const aName = a.name.toLowerCase().startsWith(query) ? 1 : 0;
          const bName = b.name.toLowerCase().startsWith(query) ? 1 : 0;
          if (bName !== aName) return bName - aName;
        }
        if (b.sortTs !== a.sortTs) return b.sortTs - a.sortTs;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 40);
  }

  function createQuickSwitchIcon(entry) {
    const icon = document.createElement('span');
    icon.className = `quick-switcher-icon quick-switcher-icon--${entry.kind}`;
    if (entry.hasAvatar && entry.avatarUrl) {
      const img = document.createElement('img');
      img.src = entry.avatarUrl;
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        img.remove();
        icon.textContent =
          entry.kind === 'room' ? '#' : entry.kind === 'space' ? '*' : initials(entry.name);
      });
      icon.appendChild(img);
      return icon;
    }
    if (entry.kind === 'room') icon.textContent = '#';
    else if (entry.kind === 'space') icon.textContent = '*';
    else icon.textContent = initials(entry.name);
    return icon;
  }

  function renderQuickSwitcherResults() {
    if (!quickSwitcherResults) return;
    const filtered = filterQuickSwitchEntries(quickSwitchItems, quickSwitcherInput?.value || '');
    quickSwitcherResults.replaceChildren();

    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'quick-switcher-empty';
      empty.textContent = 'No matches';
      quickSwitcherResults.append(empty);
      quickSwitchIndex = 0;
      return;
    }

    if (quickSwitchIndex >= filtered.length) quickSwitchIndex = 0;
    filtered.forEach((entry, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `quick-switcher-item${index === quickSwitchIndex ? ' is-active' : ''}`;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', index === quickSwitchIndex ? 'true' : 'false');

      const copy = document.createElement('span');
      copy.className = 'quick-switcher-copy';
      const name = document.createElement('span');
      name.className = 'quick-switcher-name';
      name.textContent = entry.name;
      const handle = document.createElement('span');
      handle.className = 'quick-switcher-handle';
      handle.textContent = entry.handle;
      copy.append(name, handle);

      const domain = document.createElement('span');
      domain.className = 'quick-switcher-domain';
      domain.textContent = entry.domain || '';

      button.append(createQuickSwitchIcon(entry), copy, domain);
      button.addEventListener('mouseenter', () => {
        quickSwitchIndex = index;
        syncQuickSwitcherActive();
      });
      button.addEventListener('click', () => {
        void activateQuickSwitchEntry(entry);
      });
      quickSwitcherResults.append(button);
    });
  }

  function syncQuickSwitcherActive() {
    if (!quickSwitcherResults) return;
    const buttons = [...quickSwitcherResults.querySelectorAll('.quick-switcher-item')];
    buttons.forEach((button, index) => {
      const active = index === quickSwitchIndex;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      if (active) button.scrollIntoView({ block: 'nearest' });
    });
  }

  function getVisibleQuickSwitchEntries() {
    return filterQuickSwitchEntries(quickSwitchItems, quickSwitcherInput?.value || '');
  }

  async function activateQuickSwitchEntry(entry) {
    if (!entry) return;
    closeQuickSwitcher();
    if (entry.kind === 'space') {
      setSpaceFilter(entry.id);
      return;
    }
    const targetSpace = entry.isDirect ? 'dms' : 'home';
    if (activeSpaceFilter !== targetSpace) {
      activeSpaceFilter = targetSpace;
      localStorage.setItem('relay.space', activeSpaceFilter);
      syncWorkspaceRailSelection();
    }
    openRoomEntry({
      roomId: entry.roomId,
      name: entry.name,
      isDirect: entry.isDirect,
      dmUserId: entry.dmUserId,
      avatarUrl: entry.avatarUrl,
      hasAvatar: entry.hasAvatar,
    });
  }

  async function openQuickSwitcher() {
    if (!quickSwitcher || chatView?.hidden) return;
    hideSpaceMenu();
    hideRoomMenu();
    hideMessageMenu();
    hideAccountMenu();
    hideRailAddMenu();
    closeComposerPanels();
    if (settingsOpen) closeSettings();

    railSearchBtn?.classList.add('is-active');
    if (!quickSwitcher.open) quickSwitcher.showModal();

    try {
      const data = await api('/api/rooms?space=home');
      quickSwitchRoomsCache = Array.isArray(data.rooms) ? data.rooms : [];
    } catch {
      quickSwitchRoomsCache = roomCatalog.slice();
    }

    quickSwitchItems = buildQuickSwitchEntries(quickSwitchRoomsCache);
    quickSwitchIndex = 0;
    if (quickSwitcherInput) {
      quickSwitcherInput.value = '';
      quickSwitcherInput.focus();
      quickSwitcherInput.select();
    }
    renderQuickSwitcherResults();
  }

  function syncWorkspaceRailSelection() {
    for (const button of workspaceRail.querySelectorAll('[data-space]')) {
      const selected = button.dataset.space === activeSpaceFilter;
      button.classList.toggle('is-active', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    syncSpaceFilterHeading();
    syncDmRailChrome();
  }

  function syncDmRailChrome() {
    const isDms = activeSpaceFilter === 'dms';
    const isSpace = String(activeSpaceFilter || '').startsWith('!');
    if (dmRailNav) dmRailNav.hidden = !isDms;
    if (spaceRailNav) spaceRailNav.hidden = !isSpace;
    if (railHeadDefaultActions) railHeadDefaultActions.hidden = isDms;
    if (railHeadDmActions) railHeadDmActions.hidden = !isDms;
    if (!isDms && createChatOpen) closeCreateChat();
    if (!isSpace && lobbyOpen) closeLobby();
    if (!isSpace && forumOpen) closeForum();
    syncDmRailNavActive();
    syncSpaceRailNavActive();
  }

  function syncDmRailNavActive() {
    dmCreateChatBtn?.classList.toggle('is-active', createChatOpen);
    dmCreateChatHeadBtn?.classList.toggle('is-active', createChatOpen);
    dmMessageSearchBtn?.classList.toggle('is-active', messageSearchOpen);
    dmInvitesBtn?.classList.toggle('is-active', Boolean(invitesPanel && !invitesPanel.hidden));
  }

  function syncSpaceRailNavActive() {
    const surfaceOpen = (lobbyOpen || forumOpen) && !messageSearchOpen;
    spaceLobbyBtn?.classList.toggle('is-active', surfaceOpen);
    spaceMessageSearchBtn?.classList.toggle('is-active', messageSearchOpen);
  }

  function updateSpaceLobbyBtnLabel(isForum) {
    if (spaceLobbyBtnLabel) spaceLobbyBtnLabel.textContent = isForum ? 'Feed' : 'Lobby';
  }

  function closeForum() {
    forumOpen = false;
    forumThread = null;
    forumReplyToEventId = null;
    chatStage?.classList.remove('is-forum');
    if (forumPane) forumPane.hidden = true;
    syncSpaceRailNavActive();
  }

  function closeLobby() {
    lobbyOpen = false;
    chatStage?.classList.remove('is-lobby');
    if (lobbyPane) lobbyPane.hidden = true;
    syncSpaceRailNavActive();
  }

  function getCreateChildAccess() {
    const checked = createChildForm?.querySelector('input[name="createChildAccess"]:checked');
    return String(checked?.value || 'restricted').toLowerCase();
  }

  function syncCreateChildAccessUi() {
    const access = getCreateChildAccess();
    createChildForm?.querySelectorAll('.create-room-access-card').forEach((card) => {
      const input = card.querySelector('input[name="createChildAccess"]');
      card.classList.toggle('is-selected', Boolean(input?.checked));
    });
    if (createChildNamePrefix) {
      createChildNamePrefix.textContent = '#';
      createChildNamePrefix.dataset.access = access;
    }
    if (createChildAliasBlock) createChildAliasBlock.hidden = access !== 'public';
    if (createChildEncryptionRow) createChildEncryptionRow.hidden = access === 'public';
    if (createChildKnockRow) {
      createChildKnockRow.hidden = access === 'public';
    }
    if (access === 'public' && createChildEncryption) createChildEncryption.checked = false;
  }

  function openCreateChildDialog({ parentSpaceId, parentRoomId, kind = 'room' } = {}) {
    const isSubRoom = kind === 'subroom';
    const parentId = isSubRoom
      ? parentRoomId
      : parentSpaceId || activeSpaceFilter;
    if (!String(parentId || '').startsWith('!')) return;
    const isSpace = kind === 'space';
    if (createChildParentId) createChildParentId.value = parentId;
    if (createChildKind) {
      createChildKind.value = isSubRoom ? 'subroom' : isSpace ? 'space' : 'room';
    }
    if (createChildTitle) {
      createChildTitle.textContent = isSubRoom
        ? 'New Sub-Room'
        : isSpace
          ? 'New Space'
          : 'New Room';
    }
    if (createChildLede) {
      createChildLede.hidden = true;
      createChildLede.textContent = isSubRoom
        ? 'Create a nested room under this channel.'
        : isSpace
          ? 'Create a subspace under this space.'
          : 'Create a room in this space.';
    }
    if (createChildAccessBlock) createChildAccessBlock.hidden = isSubRoom;
    if (createChildOptionsBlock) createChildOptionsBlock.hidden = isSubRoom;
    const restrictedRadio = createChildForm?.querySelector(
      'input[name="createChildAccess"][value="restricted"]',
    );
    const privateRadio = createChildForm?.querySelector(
      'input[name="createChildAccess"][value="private"]',
    );
    if (restrictedRadio) restrictedRadio.checked = !isSubRoom;
    if (privateRadio && isSubRoom) privateRadio.checked = true;
    if (createChildName) {
      createChildName.value = '';
      createChildName.placeholder = isSubRoom ? 'wishlist' : isSpace ? 'projects' : 'general';
    }
    if (createChildTopic) createChildTopic.value = '';
    if (createChildAlias) createChildAlias.value = '';
    if (createChildEncryption) createChildEncryption.checked = false;
    if (createChildForum) createChildForum.checked = false;
    if (createChildKnock) createChildKnock.checked = false;
    if (createChildFederation) createChildFederation.checked = true;
    if (createChildAdvanceOptions) createChildAdvanceOptions.hidden = true;
    if (createChildAdvanceToggle) {
      createChildAdvanceToggle.innerHTML = 'Advance Options <span aria-hidden="true">▾</span>';
    }
    if (createChildError) {
      createChildError.hidden = true;
      createChildError.textContent = '';
    }
    syncCreateChildAccessUi();
    if (typeof createChildDialog?.showModal === 'function') {
      createChildDialog.showModal();
      createChildName?.focus();
    }
  }

  function closeCreateChildDialog() {
    if (createChildDialog?.open) createChildDialog.close();
  }

  function renderLobby() {
    if (!lobbyBody) return;
    lobbyBody.innerHTML = '';
    const summary = lobbySpaceSummary;
    const name = summary?.name || spaceLabel(activeSpaceFilter);
    const topic = String(summary?.topic || '').trim();
    const avatarUrl = summary?.avatarUrl || null;
    const hasAvatar = summary?.hasAvatar !== false && Boolean(avatarUrl);

    const hero = document.createElement('header');
    hero.className = 'lobby-hero';

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'lobby-hero-avatar';
    if (hasAvatar) {
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.src = avatarUrl;
      img.addEventListener(
        'error',
        () => {
          avatarWrap.innerHTML = '';
          const fallback = document.createElement('span');
          fallback.className = 'lobby-hero-avatar-fallback';
          fallback.textContent = initials(name);
          avatarWrap.appendChild(fallback);
        },
        { once: true },
      );
      avatarWrap.appendChild(img);
    } else {
      const fallback = document.createElement('span');
      fallback.className = 'lobby-hero-avatar-fallback';
      fallback.textContent = initials(name);
      avatarWrap.appendChild(fallback);
    }
    hero.appendChild(avatarWrap);

    const title = document.createElement('h2');
    title.className = 'lobby-hero-title';
    title.textContent = name;
    hero.appendChild(title);

    if (topic) {
      const topicEl = document.createElement('p');
      topicEl.className = 'lobby-hero-topic';
      topicEl.textContent = topic;
      hero.appendChild(topicEl);
    }
    lobbyBody.appendChild(hero);

    const groups = Array.isArray(roomSidebarGroups) ? roomSidebarGroups : [];
    const appendAddBtn = (actions, { label, kind, parentId, ghost = false } = {}) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `lobby-add-btn${ghost ? ' lobby-add-btn--ghost' : ''}`;
      btn.textContent = label;
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openCreateChildDialog({ parentSpaceId: parentId, kind });
      });
      actions.appendChild(btn);
    };

    const appendCard = (sectionEl, item) => {
      const isSubspace = item?.type === 'subspace';
      const title = item?.name || (isSubspace ? item.spaceId : item?.roomId) || 'Room';
      const row = document.createElement('div');
      row.className = `lobby-card${isSubspace ? ' lobby-card--subspace' : ''}`;
      row.setAttribute('role', 'button');
      row.tabIndex = 0;

      const open = () => {
        if (isSubspace && item.spaceId) {
          if (item.name) spaceNameCache.set(item.spaceId, item.name);
          setSpaceFilter(item.spaceId, { openFirst: false });
          return;
        }
        if (item?.roomId) openRoomEntry(item);
      };

      const hasAvatarUrl = item?.hasAvatar !== false && Boolean(item?.avatarUrl);
      const avatarWrap = document.createElement('span');
      avatarWrap.className = 'lobby-card-avatar-wrap';
      if (hasAvatarUrl) {
        const img = document.createElement('img');
        img.className = 'lobby-card-avatar';
        img.alt = '';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.src = item.avatarUrl;
        img.addEventListener(
          'error',
          () => {
            avatarWrap.innerHTML = '';
            const icon = document.createElement('span');
            icon.className = 'lobby-card-avatar-fallback lobby-card-avatar-fallback--icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.innerHTML = `<svg class="ui-icon ui-icon--stroke" viewBox="0 0 24 24">${roomJoinRuleIconSvg(item.joinRule)}</svg>`;
            avatarWrap.appendChild(icon);
          },
          { once: true },
        );
        avatarWrap.appendChild(img);
      } else {
        const icon = document.createElement('span');
        icon.className = 'lobby-card-avatar-fallback lobby-card-avatar-fallback--icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = `<svg class="ui-icon ui-icon--stroke" viewBox="0 0 24 24">${roomJoinRuleIconSvg(item.joinRule)}</svg>`;
        avatarWrap.appendChild(icon);
      }
      row.appendChild(avatarWrap);

      const copy = document.createElement('div');
      copy.className = 'lobby-card-copy';
      const nameRow = document.createElement('div');
      nameRow.className = 'lobby-card-name-row';
      const nameEl = document.createElement('span');
      nameEl.className = 'lobby-card-name';
      nameEl.textContent = title;
      nameRow.appendChild(nameEl);
      if (item?.suggested) {
        const tag = document.createElement('span');
        tag.className = 'lobby-suggested';
        tag.textContent = 'Suggested';
        nameRow.appendChild(tag);
      }
      copy.appendChild(nameRow);

      const meta = document.createElement('div');
      meta.className = 'lobby-card-meta';
      const count = Number(item?.memberCount) || 0;
      const members = document.createElement('span');
      members.className = 'lobby-card-members';
      members.textContent = `${count} Member${count === 1 ? '' : 's'}`;
      meta.appendChild(members);
      const topic = String(item?.topic || '').trim();
      if (topic) {
        const sep = document.createElement('span');
        sep.className = 'lobby-card-meta-sep';
        sep.setAttribute('aria-hidden', 'true');
        meta.appendChild(sep);
        const topicEl = document.createElement('span');
        topicEl.className = 'lobby-card-topic';
        topicEl.textContent = topic;
        topicEl.title = topic;
        meta.appendChild(topicEl);
      }
      copy.appendChild(meta);
      row.appendChild(copy);

      const actions = document.createElement('div');
      actions.className = 'lobby-card-actions';
      if (item?.roomId && !isSubspace) {
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'lobby-card-more';
        more.title = 'Room options';
        more.setAttribute('aria-label', `Options for ${title}`);
        more.textContent = '⋯';
        more.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const rect = more.getBoundingClientRect();
          showRoomMenu(item.roomId, rect.right - 8, rect.bottom + 4, more);
        });
        actions.appendChild(more);
      }
      const chevron = document.createElement('span');
      chevron.className = 'lobby-card-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.innerHTML =
        '<svg class="ui-icon ui-icon--stroke" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>';
      actions.appendChild(chevron);
      row.appendChild(actions);

      row.addEventListener('click', open);
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
      sectionEl.appendChild(row);
    };

    // Fallback: older/shim payloads may only send flat rooms
    const lobbyGroups =
      groups.length > 0
        ? groups
        : roomCatalog.length
          ? [
              {
                type: 'section',
                id: `${activeSpaceFilter}:rooms`,
                spaceId: activeSpaceFilter,
                name: 'Rooms',
                items: roomCatalog.map((room) => ({ type: 'room', ...room })),
                rooms: roomCatalog.slice(),
              },
            ]
          : [];

    if (!lobbyGroups.length) {
      const section = document.createElement('section');
      section.className = 'lobby-section';
      const head = document.createElement('div');
      head.className = 'lobby-section-head';
      const title = document.createElement('span');
      title.className = 'lobby-section-title';
      title.textContent = 'Rooms';
      head.appendChild(title);
      const actions = document.createElement('div');
      actions.className = 'lobby-section-actions';
      appendAddBtn(actions, {
        label: '+ Add Room',
        kind: 'room',
        parentId: activeSpaceFilter,
      });
      appendAddBtn(actions, {
        label: '+ Add Space',
        kind: 'space',
        parentId: activeSpaceFilter,
        ghost: true,
      });
      head.appendChild(actions);
      section.appendChild(head);
      const empty = document.createElement('div');
      empty.className = 'lobby-section-empty';
      empty.innerHTML =
        '<strong>No Rooms</strong><span>This space does not contains rooms yet.</span>';
      section.appendChild(empty);
      lobbyBody.appendChild(section);
      try {
        window.KitsuStandalone?.hydrateMedia?.();
      } catch {
        /* ignore */
      }
      return;
    }

    for (const group of lobbyGroups) {
      const section = document.createElement('section');
      section.className = 'lobby-section';
      const head = document.createElement('div');
      head.className = 'lobby-section-head';
      const title = document.createElement('span');
      title.className = 'lobby-section-title';
      title.textContent = group.name || 'Rooms';
      head.appendChild(title);
      if (group.suggested) {
        const tag = document.createElement('span');
        tag.className = 'lobby-suggested';
        tag.textContent = 'Suggested';
        head.appendChild(tag);
      }
      const actions = document.createElement('div');
      actions.className = 'lobby-section-actions';
      const parentId =
        group.type === 'folder' && group.id ? group.id : activeSpaceFilter;
      appendAddBtn(actions, {
        label: '+ Add Room',
        kind: 'room',
        parentId,
      });
      if (group.type === 'section' || group.id === `${activeSpaceFilter}:rooms`) {
        appendAddBtn(actions, {
          label: '+ Add Space',
          kind: 'space',
          parentId: activeSpaceFilter,
          ghost: true,
        });
      }
      head.appendChild(actions);
      section.appendChild(head);

      const items =
        Array.isArray(group.items) && group.items.length
          ? group.items
          : (group.rooms || []).map((room) => ({ type: 'room', ...room }));

      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'lobby-section-empty';
        empty.innerHTML =
          '<strong>No Rooms</strong><span>This space does not contains rooms yet.</span>';
        section.appendChild(empty);
      } else {
        for (const item of items) appendCard(section, item);
      }
      lobbyBody.appendChild(section);
    }
    try {
      window.KitsuStandalone?.hydrateMedia?.();
    } catch {
      /* ignore */
    }
  }

  function openLobby() {
    if (!String(activeSpaceFilter || '').startsWith('!')) return;
    if (settingsOpen) closeSettings();
    closeMessageSearch();
    closeCreateChat();
    closeForum();
    hideRoomPinsPanel();
    lobbyOpen = true;
    activeRoomId = null;
    clearTimelineHead();
    messageList.innerHTML = '';
    composerForm.hidden = true;
    setMembersPanelOpen(false);
    updateCallChrome();
    if (lobbyPane) lobbyPane.hidden = false;
    chatStage?.classList.add('is-lobby');
    renderLobby();
    syncSpaceRailNavActive();
  }

  function formatForumRelativeTime(ts) {
    const value = Number(ts) || 0;
    if (!value) return '';
    const delta = Date.now() - value;
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (delta < minute) return 'just now';
    if (delta < hour) return `${Math.floor(delta / minute)}m ago`;
    if (delta < day) return `${Math.floor(delta / hour)}h ago`;
    if (delta < 7 * day) return `${Math.floor(delta / day)}d ago`;
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return '';
    }
  }

  function renderForum() {
    if (!forumBody) return;
    if (forumThread) {
      renderForumThread();
      return;
    }
    forumBody.innerHTML = '';
    const summary = forumBoard?.space || lobbySpaceSummary;
    if (!summary) {
      const empty = document.createElement('p');
      empty.className = 'forum-empty';
      empty.textContent = 'Select a forum space to view the feed.';
      forumBody.appendChild(empty);
      return;
    }

    const hero = document.createElement('div');
    hero.className = 'lobby-hero';
    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'lobby-hero-avatar';
    if (summary.hasAvatar && summary.avatarUrl) {
      const img = document.createElement('img');
      img.src = summary.avatarUrl;
      img.alt = '';
      avatarWrap.appendChild(img);
    } else {
      const fallback = document.createElement('span');
      fallback.className = 'lobby-hero-avatar-fallback';
      fallback.textContent = String(summary.name || '?').slice(0, 1).toUpperCase();
      avatarWrap.appendChild(fallback);
    }
    hero.appendChild(avatarWrap);
    const title = document.createElement('h2');
    title.className = 'lobby-hero-title';
    title.textContent = summary.name || 'Forum';
    hero.appendChild(title);
    if (summary.topic) {
      const topic = document.createElement('p');
      topic.className = 'lobby-hero-topic';
      topic.textContent = summary.topic;
      hero.appendChild(topic);
    }
    forumBody.appendChild(hero);

    const topics = Array.isArray(forumBoard?.topics) ? forumBoard.topics : [];
    const toolbar = document.createElement('div');
    toolbar.className = 'forum-toolbar';

    const filter = document.createElement('select');
    filter.className = 'forum-topic-filter';
    filter.setAttribute('aria-label', 'Filter by topic');
    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'All topics';
    filter.appendChild(allOpt);
    for (const topic of topics) {
      const opt = document.createElement('option');
      opt.value = topic.roomId;
      opt.textContent = topic.name || topic.roomId;
      filter.appendChild(opt);
    }
    filter.value = forumTopicFilter || '';
    filter.addEventListener('change', () => {
      forumTopicFilter = filter.value || '';
      void loadForumBoard();
    });
    toolbar.appendChild(filter);

    const spacer = document.createElement('div');
    spacer.className = 'forum-toolbar-spacer';
    toolbar.appendChild(spacer);

    const newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'forum-new-post-btn';
    newBtn.textContent = 'New post';
    newBtn.disabled = topics.length === 0;
    newBtn.addEventListener('click', () => openForumPostDialog());
    toolbar.appendChild(newBtn);
    forumBody.appendChild(toolbar);

    const posts = Array.isArray(forumBoard?.posts) ? forumBoard.posts : [];
    if (!posts.length) {
      const empty = document.createElement('p');
      empty.className = 'forum-empty';
      empty.textContent = topics.length
        ? 'No titled posts yet. New posts use com.matrixsso.title so they show up in Paarrot too.'
        : 'Join or add topic rooms under this forum to start posting.';
      forumBody.appendChild(empty);
      return;
    }

    const feed = document.createElement('div');
    feed.className = 'forum-feed';
    for (const post of posts) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'forum-post-card';
      const meta = document.createElement('div');
      meta.className = 'forum-post-meta';
      const bits = [
        post.sectionTitle,
        post.topicName,
        post.senderName || post.sender,
        formatForumRelativeTime(post.lastActivityTs || post.timestamp),
        post.totalReplies
          ? `${post.totalReplies} ${post.totalReplies === 1 ? 'reply' : 'replies'}`
          : null,
      ].filter(Boolean);
      meta.textContent = bits.join(' · ');
      card.appendChild(meta);
      const heading = document.createElement('h3');
      heading.className = 'forum-post-title';
      heading.textContent = post.title || '(untitled post)';
      card.appendChild(heading);
      if (post.body) {
        const excerpt = document.createElement('p');
        excerpt.className = 'forum-post-excerpt';
        excerpt.textContent = post.body;
        card.appendChild(excerpt);
      }
      card.addEventListener('click', () => {
        void openForumThread(post.topicRoomId, post.eventId, {
          topicName: post.topicName,
          preview: post,
        });
      });
      feed.appendChild(card);
    }
    forumBody.appendChild(feed);
  }

  function appendForumReplyTree(container, replies, depth = 0) {
    for (const reply of replies || []) {
      const item = document.createElement('article');
      item.className = 'forum-thread-reply';
      item.dataset.depth = String(Math.min(depth, 4));
      item.dataset.eventId = reply.eventId || '';
      const meta = document.createElement('div');
      meta.className = 'forum-thread-meta';
      meta.textContent = [
        reply.senderName || reply.sender,
        formatForumRelativeTime(reply.timestamp),
      ]
        .filter(Boolean)
        .join(' · ');
      item.appendChild(meta);
      const body = document.createElement('p');
      body.className = 'forum-thread-reply-body';
      body.textContent = reply.body || '';
      item.appendChild(body);
      if (forumThread?.roomId && reply.eventId) {
        const reactions = buildReactionRow(reply.reactions, {
          roomId: forumThread.roomId,
          eventId: reply.eventId,
          className: 'forum-thread-reactions',
        });
        if (reactions) item.appendChild(reactions);
      }
      const actions = document.createElement('div');
      actions.className = 'forum-thread-reply-actions';
      const replyBtn = document.createElement('button');
      replyBtn.type = 'button';
      replyBtn.className = 'forum-thread-reply-btn';
      replyBtn.textContent = 'Reply';
      replyBtn.addEventListener('click', () => {
        forumReplyToEventId = reply.eventId || null;
        renderForumThread();
        forumBody?.querySelector('.forum-thread-composer textarea')?.focus();
      });
      actions.appendChild(replyBtn);
      item.appendChild(actions);
      container.appendChild(item);
      if (reply.replies?.length) appendForumReplyTree(container, reply.replies, depth + 1);
    }
  }

  function renderForumThread() {
    if (!forumBody || !forumThread) return;
    forumBody.innerHTML = '';
    const data = forumThread.data;
    const post = data?.post;
    const wrap = document.createElement('div');
    wrap.className = 'forum-thread';

    const bar = document.createElement('div');
    bar.className = 'forum-thread-bar';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'forum-thread-back';
    back.textContent = '← Feed';
    back.addEventListener('click', () => {
      forumThread = null;
      forumReplyToEventId = null;
      renderForum();
    });
    bar.appendChild(back);
    const topic = document.createElement('span');
    topic.className = 'forum-thread-topic';
    topic.textContent = data?.topicName || forumThread.topicName || 'Topic';
    bar.appendChild(topic);
    const openRoom = document.createElement('button');
    openRoom.type = 'button';
    openRoom.className = 'forum-thread-open-room';
    openRoom.textContent = 'Open in room';
    openRoom.addEventListener('click', () => {
      openRoomEntry(
        {
          roomId: forumThread.roomId,
          name: data?.topicName || forumThread.topicName || forumThread.roomId,
        },
        { scrollToEventId: forumThread.eventId },
      );
    });
    bar.appendChild(openRoom);
    wrap.appendChild(bar);

    if (!post) {
      const empty = document.createElement('p');
      empty.className = 'forum-empty';
      empty.textContent = 'Loading thread…';
      wrap.appendChild(empty);
      forumBody.appendChild(wrap);
      return;
    }

    const root = document.createElement('article');
    root.className = 'forum-thread-root';
    const rootMeta = document.createElement('div');
    rootMeta.className = 'forum-thread-meta';
    rootMeta.textContent = [
      post.senderName || post.sender,
      formatForumRelativeTime(post.timestamp),
      post.totalReplies
        ? `${post.totalReplies} ${post.totalReplies === 1 ? 'reply' : 'replies'}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ');
    root.appendChild(rootMeta);
    const title = document.createElement('h2');
    title.className = 'forum-thread-root-title';
    title.textContent = post.title || '(untitled post)';
    root.appendChild(title);
    if (post.body) {
      const body = document.createElement('p');
      body.className = 'forum-thread-root-body';
      body.textContent = post.body;
      root.appendChild(body);
    }
    if (forumThread?.roomId && post.eventId) {
      const reactions = buildReactionRow(post.reactions, {
        roomId: forumThread.roomId,
        eventId: post.eventId,
        className: 'forum-thread-reactions',
      });
      if (reactions) root.appendChild(reactions);
    }
    wrap.appendChild(root);

    const repliesWrap = document.createElement('div');
    repliesWrap.className = 'forum-thread-replies';
    if (!post.replies?.length) {
      const empty = document.createElement('p');
      empty.className = 'forum-empty';
      empty.textContent = 'No replies yet.';
      repliesWrap.appendChild(empty);
    } else {
      appendForumReplyTree(repliesWrap, post.replies, 0);
    }
    wrap.appendChild(repliesWrap);

    const composer = document.createElement('form');
    composer.className = 'forum-thread-composer';
    if (forumReplyToEventId) {
      const hint = document.createElement('div');
      hint.className = 'forum-thread-replying';
      hint.appendChild(document.createTextNode('Replying to a comment'));
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', () => {
        forumReplyToEventId = null;
        renderForumThread();
      });
      hint.appendChild(cancel);
      composer.appendChild(hint);
    }
    const textarea = document.createElement('textarea');
    textarea.placeholder = forumReplyToEventId ? 'Write a reply…' : 'Reply to this post…';
    textarea.rows = 3;
    composer.appendChild(textarea);
    const err = document.createElement('p');
    err.className = 'forum-thread-error';
    err.hidden = true;
    composer.appendChild(err);
    const actions = document.createElement('div');
    actions.className = 'forum-thread-composer-actions';
    const send = document.createElement('button');
    send.type = 'submit';
    send.className = 'forum-thread-send';
    send.textContent = 'Reply';
    actions.appendChild(send);
    composer.appendChild(actions);
    composer.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = String(textarea.value || '').trim();
      if (!body || !forumThread) return;
      send.disabled = true;
      err.hidden = true;
      try {
        await api(
          `/api/rooms/${encodeURIComponent(forumThread.roomId)}/forum-posts/${encodeURIComponent(forumThread.eventId)}/replies`,
          {
            method: 'POST',
            body: JSON.stringify({
              body,
              replyToEventId: forumReplyToEventId || forumThread.eventId,
            }),
          },
        );
        forumReplyToEventId = null;
        textarea.value = '';
        await loadForumThread(forumThread.roomId, forumThread.eventId, { quiet: true });
        void loadForumBoard({ quiet: true });
      } catch (error) {
        err.hidden = false;
        err.textContent = (error.message || String(error)).replace(/^MatrixError:\s*/i, '');
      } finally {
        send.disabled = false;
      }
    });
    wrap.appendChild(composer);
    forumBody.appendChild(wrap);
  }

  async function loadForumThread(roomId, eventId, { quiet = false } = {}) {
    try {
      const data = await api(
        `/api/rooms/${encodeURIComponent(roomId)}/forum-posts/${encodeURIComponent(eventId)}`,
      );
      if (forumThread?.roomId === roomId && forumThread?.eventId === eventId) {
        forumThread = {
          ...forumThread,
          data,
          topicName: data?.topicName || forumThread.topicName,
        };
        if (forumOpen) renderForumThread();
      }
      return data;
    } catch (error) {
      if (!quiet && forumOpen) {
        forumBody.innerHTML = '';
        const empty = document.createElement('p');
        empty.className = 'forum-empty';
        empty.textContent =
          (error.message || String(error)).replace(/^MatrixError:\s*/i, '') ||
          'Could not load thread.';
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'forum-thread-back';
        back.textContent = '← Feed';
        back.style.marginTop = '0.75rem';
        back.addEventListener('click', () => {
          forumThread = null;
          renderForum();
        });
        forumBody.appendChild(empty);
        forumBody.appendChild(back);
      }
      throw error;
    }
  }

  async function openForumThread(roomId, eventId, { topicName = '', preview = null } = {}) {
    if (!roomId || !eventId) return;
    forumReplyToEventId = null;
    forumThread = {
      roomId,
      eventId,
      topicName,
      data: preview
        ? {
            topicName,
            post: {
              ...preview,
              replies: [],
            },
          }
        : null,
    };
    if (!forumOpen) openForum();
    else renderForumThread();
    try {
      await loadForumThread(roomId, eventId);
    } catch {
      // error UI handled in loadForumThread
    }
  }

  async function loadForumBoard({ quiet = false } = {}) {
    if (!String(activeSpaceFilter || '').startsWith('!')) return;
    try {
      const params = new URLSearchParams();
      if (forumTopicFilter) params.set('topic', forumTopicFilter);
      const qs = params.toString();
      const data = await api(
        `/api/spaces/${encodeURIComponent(activeSpaceFilter)}/forum${qs ? `?${qs}` : ''}`,
      );
      forumBoard = data;
      if (data?.space) lobbySpaceSummary = data.space;
      if (forumOpen) renderForum();
    } catch (error) {
      if (!quiet) {
        forumBoard = { space: lobbySpaceSummary, topics: [], posts: [], sections: [] };
        if (forumOpen) renderForum();
        console.warn('Forum board load failed', error);
      }
    }
  }

  function openForum() {
    if (!String(activeSpaceFilter || '').startsWith('!')) return;
    if (settingsOpen) closeSettings();
    closeMessageSearch();
    closeCreateChat();
    closeLobby();
    hideRoomPinsPanel();
    forumOpen = true;
    activeRoomId = null;
    clearTimelineHead();
    messageList.innerHTML = '';
    composerForm.hidden = true;
    setMembersPanelOpen(false);
    updateCallChrome();
    if (forumPane) forumPane.hidden = false;
    chatStage?.classList.add('is-forum');
    renderForum();
    syncSpaceRailNavActive();
    void loadForumBoard();
  }

  function openForumPostDialog() {
    const topics = Array.isArray(forumBoard?.topics) ? forumBoard.topics : [];
    if (!topics.length || !forumPostDialog) return;
    if (forumPostTopic) {
      forumPostTopic.innerHTML = '';
      for (const topic of topics) {
        const opt = document.createElement('option');
        opt.value = topic.roomId;
        opt.textContent = topic.name || topic.roomId;
        forumPostTopic.appendChild(opt);
      }
      if (forumTopicFilter) forumPostTopic.value = forumTopicFilter;
    }
    if (forumPostTitle) forumPostTitle.value = '';
    if (forumPostBody) forumPostBody.value = '';
    if (forumPostError) {
      forumPostError.hidden = true;
      forumPostError.textContent = '';
    }
    if (typeof forumPostDialog.showModal === 'function') forumPostDialog.showModal();
    else forumPostDialog.setAttribute('open', '');
  }

  function closeForumPostDialog() {
    if (!forumPostDialog) return;
    if (typeof forumPostDialog.close === 'function') forumPostDialog.close();
    else forumPostDialog.removeAttribute('open');
  }

  function closeCreateChat() {
    createChatOpen = false;
    chatStage?.classList.remove('is-create-chat');
    if (createChatPane) createChatPane.hidden = true;
    syncDmRailNavActive();
  }

  function openCreateChat() {
    if (settingsOpen) closeSettings();
    closeMessageSearch();
    closeLobby();
    closeForum();
    hideRoomPinsPanel();
    createChatOpen = true;
    activeRoomId = null;
    clearTimelineHead();
    messageList.innerHTML = '';
    composerForm.hidden = true;
    setMembersPanelOpen(false);
    updateCallChrome();
    if (createChatError) {
      createChatError.hidden = true;
      createChatError.textContent = '';
    }
    if (createChatUserId) createChatUserId.value = '';
    if (createChatEncrypted) createChatEncrypted.checked = true;
    if (createChatPane) createChatPane.hidden = false;
    chatStage?.classList.add('is-create-chat');
    syncDmRailNavActive();
    window.setTimeout(() => createChatUserId?.focus(), 40);
  }

  function openRoomEntry(room, { scrollToEventId = null } = {}) {
    if (!room?.roomId) return;
    closeCreateChat();
    closeLobby();
    closeForum();
    const sameRoom = activeRoomId === room.roomId;
    if (activeRoomId && !sameRoom) {
      void sendTypingState(false);
      saveComposerDraft(activeRoomId);
    }
    activeRoomId = room.roomId;
    persistLastRoom(room.roomId);
    syncControlRoom(room.roomId);
    localTypingSent = false;
    lastTypingFingerprint = '';
    updateTimelineHead(room);
    composerForm.hidden = false;
    clearPendingAttachments();
    clearPendingReply();
    clearPendingEdit();
    pendingReactionTarget = null;
    hideRoomMenu();
    closeComposerPanels();
    hideComposerAutocomplete();
    if (!sameRoom) restoreComposerDraft(room.roomId);
    pendingScrollEventId = scrollToEventId || null;
    const mode = scrollOnReselectMode();
    let pinBottom = !pendingScrollEventId;
    if (sameRoom && !pendingScrollEventId) {
      if (mode === 'never') pinBottom = false;
      else if (mode === 'if-at-bottom') pinBottom = Boolean(stickMessagesToBottom);
      else pinBottom = true;
    } else if (!pendingScrollEventId) {
      stickMessagesToBottom = true;
      messageScrollRoomId = null;
      lastMessagesFingerprint = '';
      lastMessagesContentFingerprint = '';
    } else {
      stickMessagesToBottom = false;
      messageScrollRoomId = null;
      lastMessagesFingerprint = '';
      lastMessagesContentFingerprint = '';
    }
    if (pinBottom) stickMessagesToBottom = true;
    updateCallChrome();
    if (isMobileUi()) setRoomsDrawerOpen(false);
    setMembersPanelOpen(membersPanelOpen);
    if (sharedMediaOpen) void refreshSharedMedia(room.roomId);
    void refreshMessages(room.roomId, {
      pinBottom,
      history: true,
      limit: sameRoom ? 160 : 120,
      minMessages: sameRoom ? 160 : 100,
    }).then(() => {
      if (!pendingScrollEventId) return;
      const eventId = pendingScrollEventId;
      pendingScrollEventId = null;
      void jumpToMessage(eventId, {
        missingMessage: 'That post is not in the loaded timeline yet.',
      });
    });
    void refreshTypingIndicator();
    void refreshRooms();
  }

  let pendingOpenFirstDm = false;

  async function openFirstRoomInCatalog({ retries = 25, delayMs = 150 } = {}) {
    // Ensure the Chats section is expanded so the selection is visible.
    if (activeSpaceFilter === 'dms') {
      const sectionId = `flat:${activeSpaceFilter}`;
      if (isRoomFolderClosed(sectionId)) setRoomFolderClosed(sectionId, false);
    }

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const first =
        roomCatalog.find((entry) => entry?.roomId && entry?.isDirect) ||
        roomCatalog.find((entry) => entry?.roomId);
      if (first?.roomId) {
        pendingOpenFirstDm = false;
        openRoomEntry(first);
        return true;
      }
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      try {
        await refreshRooms();
      } catch {
        // keep retrying while sync catches up
      }
    }
    return false;
  }

  async function setSpaceFilter(filter, { openFirst } = {}) {
    if (settingsOpen) closeSettings();
    closeMessageSearch();
    closeCreateChat();
    const next = filter || 'dms';
    // Opening Direct Messages always selects the first chat unless explicitly disabled
    // (e.g. creating a DM and jumping to that specific room).
    const shouldOpenFirst =
      typeof openFirst === 'boolean' ? openFirst : next === 'dms';
    activeSpaceFilter = next;
    localStorage.setItem('relay.space', activeSpaceFilter);
    forumTopicFilter = '';
    forumBoard = null;
    forumThread = null;
    forumReplyToEventId = null;
    activeRoomId = null;
    clearTimelineHead();
    messageList.innerHTML = '';
    composerForm.hidden = true;
    setMembersPanelOpen(false);
    updateCallChrome();
    syncWorkspaceRailSelection();
    pendingOpenFirstDm = shouldOpenFirst && next === 'dms';
    try {
      await refreshRooms();
    } catch {
      // refreshRooms handles its own errors
    }
    if (shouldOpenFirst) {
      closeLobby();
      closeForum();
      await openFirstRoomInCatalog();
      return;
    }
    pendingOpenFirstDm = false;
    if (String(activeSpaceFilter).startsWith('!')) {
      if (lobbySpaceSummary?.isForum) openForum();
      else openLobby();
    } else {
      closeLobby();
      closeForum();
    }
  }

  function clearRailDragHints() {
    if (!spaceRailList) return;
    for (const el of spaceRailList.querySelectorAll(
      '.is-drop-target, .is-folder-drop, [data-drop-above], [data-drop-below]',
    )) {
      el.classList.remove('is-drop-target', 'is-folder-drop');
      el.removeAttribute('data-drop-above');
      el.removeAttribute('data-drop-below');
    }
    for (const el of spaceRailList.querySelectorAll('.rail-folder.is-folder-drop')) {
      el.classList.remove('is-folder-drop');
    }
    const marker = spaceRailList.querySelector('.rail-drop-line');
    if (marker) {
      marker.classList.remove('is-active');
      marker.style.top = '';
    }
    spaceRailList.classList.remove('is-ungroup-drop');
    workspaceRail?.classList.remove('is-ungroup-drop');
    railDropHint = { mode: null, spaceId: null, folderId: null };
  }

  function ensureRailDropMarker() {
    let marker = spaceRailList.querySelector(':scope > .rail-drop-line');
    if (!marker) {
      marker = document.createElement('div');
      marker.className = 'rail-drop-line';
      marker.setAttribute('aria-hidden', 'true');
      spaceRailList.appendChild(marker);
    }
    return marker;
  }

  function setSpaceDropAttrs(btn, mode) {
    btn.removeAttribute('data-drop-above');
    btn.removeAttribute('data-drop-below');
    btn.classList.remove('is-drop-target', 'is-folder-drop');
    if (mode === 'before') btn.setAttribute('data-drop-above', 'true');
    else if (mode === 'after') btn.setAttribute('data-drop-below', 'true');
    else if (mode === 'folder') btn.classList.add('is-drop-target', 'is-folder-drop');
  }

  function railDropZoneForPoint(btn, clientY) {
    const rect = btn.getBoundingClientRect();
    const y = clientY - rect.top;
    const edge = Math.max(12, rect.height * 0.32);
    if (y < edge) return 'before';
    if (y > rect.height - edge) return 'after';
    return 'folder';
  }

  function applySpaceDropHint(btn, space, clientY) {
    if (!dragSpaceId || dragSpaceId === space.spaceId) {
      clearRailDragHints();
      return null;
    }
    const mode = railDropZoneForPoint(btn, clientY);
    const folderId = findSpaceFolder(space.spaceId)?.id || null;

    for (const el of spaceRailList.querySelectorAll(
      '.is-drop-target, .is-folder-drop, [data-drop-above], [data-drop-below]',
    )) {
      if (el === btn) continue;
      el.classList.remove('is-drop-target', 'is-folder-drop');
      el.removeAttribute('data-drop-above');
      el.removeAttribute('data-drop-below');
    }
    spaceRailList.querySelector('.rail-drop-line')?.classList.remove('is-active');

    setSpaceDropAttrs(btn, mode);
    railDropHint = { mode, spaceId: space.spaceId, folderId };
    return railDropHint;
  }

  function commitSpaceDrop(fromId, hint) {
    if (!fromId || !hint?.mode || !hint.spaceId) return;
    const toId = hint.spaceId;
    if (fromId === toId && hint.mode !== 'folder') return;

    if (hint.mode === 'folder') {
      if (hint.folderId) addSpaceToFolder(hint.folderId, fromId);
      else {
        const toFolder = findSpaceFolder(toId);
        if (toFolder) addSpaceToFolder(toFolder.id, fromId);
        else createSpaceFolder([fromId, toId], 'Folder');
      }
      return;
    }

    if (hint.mode === 'before') {
      placeSpaceAtGap(fromId, { beforeId: toId, folderId: hint.folderId });
      return;
    }

    if (hint.folderId) {
      const folder = findFolderById(hint.folderId);
      const members = folder?.spaceIds || [];
      const idx = members.indexOf(toId);
      const nextId = idx >= 0 ? members[idx + 1] || null : null;
      placeSpaceAtGap(fromId, { beforeId: nextId, folderId: hint.folderId });
      return;
    }

    const folders = getSpaceFolders();
    const folderBySpace = new Map();
    for (const folder of folders) {
      for (const id of folder.spaceIds) folderBySpace.set(id, folder);
    }
    const visible = orderedVisibleSpaces(spaceCatalog);
    const railIds = [];
    const seenFolders = new Set();
    for (const space of visible) {
      const folder = folderBySpace.get(space.spaceId);
      if (folder) {
        if (seenFolders.has(folder.id)) continue;
        seenFolders.add(folder.id);
        railIds.push(folder.spaceIds[0]);
        continue;
      }
      railIds.push(space.spaceId);
    }
    const railIdx = railIds.indexOf(toId);
    const nextRail = railIdx >= 0 ? railIds[railIdx + 1] || null : null;
    placeSpaceAtGap(fromId, { beforeId: nextRail, folderId: null });
  }

  function updateRailGapDropHint(clientY) {
    if (!dragSpaceId || !spaceRailList) return;
    const topTargets = [
      ...spaceRailList.querySelectorAll(
        ':scope > .workspace-rail-btn--space, :scope > .rail-folder',
      ),
    ];
    if (!topTargets.length) return;

    for (const el of spaceRailList.querySelectorAll(
      '.is-drop-target, .is-folder-drop, [data-drop-above], [data-drop-below]',
    )) {
      el.classList.remove('is-drop-target', 'is-folder-drop');
      el.removeAttribute('data-drop-above');
      el.removeAttribute('data-drop-below');
    }

    const listRect = spaceRailList.getBoundingClientRect();
    let insertBefore = null;
    let markerY = listRect.height;
    for (const el of topTargets) {
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (clientY < mid) {
        insertBefore = el;
        markerY = rect.top - listRect.top;
        break;
      }
      markerY = rect.bottom - listRect.top;
    }

    const marker = ensureRailDropMarker();
    marker.style.top = `${markerY + spaceRailList.scrollTop}px`;
    marker.classList.add('is-active');

    if (insertBefore?.classList.contains('workspace-rail-btn--space')) {
      const sid = insertBefore.dataset.space;
      railDropHint = {
        mode: 'before',
        spaceId: sid,
        folderId: findSpaceFolder(sid)?.id || null,
      };
    } else if (insertBefore?.classList.contains('rail-folder')) {
      const folder = findFolderById(insertBefore.dataset.folderId);
      railDropHint = {
        mode: 'before',
        spaceId: folder?.spaceIds[0] || null,
        folderId: null,
      };
    } else {
      const last = topTargets[topTargets.length - 1];
      if (last?.classList.contains('workspace-rail-btn--space')) {
        railDropHint = {
          mode: 'after',
          spaceId: last.dataset.space,
          folderId: findSpaceFolder(last.dataset.space)?.id || null,
        };
      } else if (last?.classList.contains('rail-folder')) {
        const folder = findFolderById(last.dataset.folderId);
        const lastId = folder?.spaceIds?.[folder.spaceIds.length - 1] || null;
        railDropHint = { mode: 'after', spaceId: lastId, folderId: null };
      }
    }
  }

  function renderSpaceRail(spaces) {
    spaceCatalog = Array.isArray(spaces) ? spaces : [];
    for (const space of spaceCatalog) {
      if (space?.spaceId && space?.name) spaceNameCache.set(space.spaceId, space.name);
    }
    ensureOrderIncludes(spaceCatalog);
    const hidden = getHiddenSpaces();
    showHiddenSpacesBtn.hidden = hidden.size === 0;
    spaceRailList.innerHTML = '';

    const folders = getSpaceFolders()
      .map((folder) => ({
        ...folder,
        spaceIds: folder.spaceIds.filter((id) => {
          const space = spaceCatalog.find((entry) => entry.spaceId === id);
          return space && !hidden.has(id);
        }),
      }))
      .filter((folder) => folder.spaceIds.length >= 2);
    // Drop empty/stale/undersized folders from storage.
    if (JSON.stringify(folders) !== JSON.stringify(getSpaceFolders())) setSpaceFolders(folders);

    const folderBySpace = new Map();
    for (const folder of folders) {
      for (const spaceId of folder.spaceIds) folderBySpace.set(spaceId, folder);
    }
    const renderedFolders = new Set();

    const attachSpaceDrag = (btn, space) => {
      btn.draggable = true;
      btn.addEventListener('dragstart', (event) => {
        dragSpaceId = space.spaceId;
        dragFolderId = null;
        railDropHint = { mode: null, spaceId: null, folderId: null };
        btn.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', space.spaceId);
        event.dataTransfer.setData('application/x-relay-space', space.spaceId);
        try {
          const ghost = btn.cloneNode(true);
          ghost.style.position = 'absolute';
          ghost.style.top = '-9999px';
          ghost.style.opacity = '0.85';
          document.body.appendChild(ghost);
          event.dataTransfer.setDragImage(ghost, btn.offsetWidth / 2, btn.offsetHeight / 2);
          requestAnimationFrame(() => ghost.remove());
        } catch {
          /* ignore */
        }
      });
      btn.addEventListener('dragend', () => {
        dragSpaceId = null;
        dragFolderId = null;
        btn.classList.remove('is-dragging');
        clearRailDragHints();
      });
      btn.addEventListener('dragover', (event) => {
        if (!dragSpaceId || dragSpaceId === space.spaceId) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        applySpaceDropHint(btn, space, event.clientY);
      });
      btn.addEventListener('dragleave', (event) => {
        if (btn.contains(event.relatedTarget)) return;
        btn.removeAttribute('data-drop-above');
        btn.removeAttribute('data-drop-below');
        btn.classList.remove('is-drop-target', 'is-folder-drop');
        if (railDropHint.spaceId === space.spaceId) {
          railDropHint = { mode: null, spaceId: null, folderId: null };
        }
      });
      btn.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const fromId =
          dragSpaceId ||
          event.dataTransfer.getData('application/x-relay-space') ||
          event.dataTransfer.getData('text/plain');
        const hint =
          railDropHint.spaceId === space.spaceId
            ? { ...railDropHint }
            : {
                mode: railDropZoneForPoint(btn, event.clientY),
                spaceId: space.spaceId,
                folderId: findSpaceFolder(space.spaceId)?.id || null,
              };
        clearRailDragHints();
        if (!fromId) return;
        commitSpaceDrop(fromId, hint);
        renderSpaceRail(spaceCatalog);
      });
    };

    const buildSpaceBtn = (space, { inFolder = false } = {}) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `workspace-rail-btn workspace-rail-btn--space${inFolder ? ' workspace-rail-btn--in-folder' : ''}`;
      btn.dataset.space = space.spaceId;
      btn.title = space.name;
      btn.setAttribute('aria-label', space.name);

      if (space.unread > 0) {
        const badge = document.createElement('span');
        badge.className = 'workspace-rail-unread';
        badge.textContent = space.unread > 99 ? '99+' : String(space.unread);
        btn.appendChild(badge);
      }

      const showFallback = () => {
        btn.querySelector('.workspace-rail-avatar')?.remove();
        if (btn.querySelector('.workspace-rail-fallback')) return;
        const fallback = document.createElement('span');
        fallback.className = 'workspace-rail-fallback';
        fallback.textContent = initials(space.name);
        btn.appendChild(fallback);
      };

      if (space.hasAvatar !== false && space.avatarUrl) {
        const img = document.createElement('img');
        img.className = 'workspace-rail-avatar';
        img.alt = '';
        img.draggable = false;
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', showFallback, { once: true });
        img.src = space.avatarUrl;
        btn.appendChild(img);
      } else {
        showFallback();
      }

      btn.addEventListener('click', () => setSpaceFilter(space.spaceId));
      btn.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        showSpaceMenu(space.spaceId, event.clientX, event.clientY);
      });
      attachSpaceDrag(btn, space);
      return btn;
    };

    const buildFolderEl = (folder) => {
      const members = folder.spaceIds
        .map((id) => spaceCatalog.find((entry) => entry.spaceId === id))
        .filter(Boolean);
      const unread = members.reduce((sum, space) => sum + (Number(space.unread) || 0), 0);
      const wrap = document.createElement('div');
      wrap.className = `rail-folder${folder.collapsed ? ' is-collapsed' : ' is-expanded'}`;
      wrap.dataset.folderId = folder.id;
      wrap.title = folder.name;

      if (folder.collapsed) {
        const stack = document.createElement('button');
        stack.type = 'button';
        stack.className = 'rail-folder-stack';
        stack.title = `${folder.name} (${members.length})`;
        stack.setAttribute('aria-label', `${folder.name}, ${members.length} spaces`);
        const grid = document.createElement('span');
        grid.className = 'rail-folder-grid';
        for (const space of members.slice(0, 4)) {
          if (space.hasAvatar !== false && space.avatarUrl) {
            const img = document.createElement('img');
            img.alt = '';
            img.draggable = false;
            img.src = space.avatarUrl;
            grid.appendChild(img);
          } else {
            const fallback = document.createElement('span');
            fallback.textContent = initials(space.name).slice(0, 1);
            grid.appendChild(fallback);
          }
        }
        stack.appendChild(grid);
        if (unread > 0) {
          const badge = document.createElement('span');
          badge.className = 'workspace-rail-unread';
          badge.textContent = unread > 99 ? '99+' : String(unread);
          stack.appendChild(badge);
        }
        stack.addEventListener('click', () => {
          updateSpaceFolder(folder.id, { collapsed: false });
          renderSpaceRail(spaceCatalog);
        });
        stack.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          showFolderMenu(folder.id, event.clientX, event.clientY);
        });
        stack.addEventListener('dragover', (event) => {
          if (!dragSpaceId || folder.spaceIds.includes(dragSpaceId)) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = 'move';
          const rect = stack.getBoundingClientRect();
          const y = event.clientY - rect.top;
          const edge = Math.max(10, rect.height * 0.28);
          for (const el of spaceRailList.querySelectorAll(
            '.is-drop-target, .is-folder-drop, [data-drop-above], [data-drop-below]',
          )) {
            el.classList.remove('is-drop-target', 'is-folder-drop');
            el.removeAttribute('data-drop-above');
            el.removeAttribute('data-drop-below');
          }
          wrap.classList.remove('is-folder-drop');
          if (y < edge || y > rect.height - edge) {
            const marker = ensureRailDropMarker();
            const listRect = spaceRailList.getBoundingClientRect();
            marker.style.top = `${(y < edge ? rect.top : rect.bottom) - listRect.top + spaceRailList.scrollTop}px`;
            marker.classList.add('is-active');
            railDropHint = {
              mode: y < edge ? 'before' : 'after',
              spaceId: folder.spaceIds[0],
              folderId: null,
            };
          } else {
            spaceRailList.querySelector('.rail-drop-line')?.classList.remove('is-active');
            wrap.classList.add('is-folder-drop');
            railDropHint = { mode: 'folder', spaceId: folder.spaceIds[0], folderId: folder.id };
          }
        });
        stack.addEventListener('drop', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const fromId =
            dragSpaceId ||
            event.dataTransfer.getData('application/x-relay-space') ||
            event.dataTransfer.getData('text/plain');
          const hint = { ...railDropHint };
          clearRailDragHints();
          if (!fromId || folder.spaceIds.includes(fromId)) return;
          if (hint.mode === 'folder' || hint.folderId === folder.id) {
            addSpaceToFolder(folder.id, fromId);
          } else if (hint.mode === 'before') {
            placeSpaceAtGap(fromId, { beforeId: folder.spaceIds[0], folderId: null });
          } else if (hint.mode === 'after') {
            const order = ensureOrderIncludes(spaceCatalog);
            const last = folder.spaceIds[folder.spaceIds.length - 1];
            const idx = order.indexOf(last);
            const nextId = idx >= 0 ? order[idx + 1] || null : null;
            placeSpaceAtGap(fromId, { beforeId: nextId, folderId: null });
          } else {
            addSpaceToFolder(folder.id, fromId);
          }
          renderSpaceRail(spaceCatalog);
        });
        wrap.appendChild(stack);
      } else {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'rail-folder-toggle';
        toggle.title = `Collapse ${folder.name}`;
        toggle.setAttribute('aria-label', `Collapse ${folder.name}`);
        toggle.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m7 14 5-5 5 5"/></svg>';
        toggle.addEventListener('click', () => {
          updateSpaceFolder(folder.id, { collapsed: true });
          renderSpaceRail(spaceCatalog);
        });
        toggle.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          showFolderMenu(folder.id, event.clientX, event.clientY);
        });
        wrap.appendChild(toggle);
        for (const member of members) {
          wrap.appendChild(buildSpaceBtn(member, { inFolder: true }));
        }
      }

      wrap.addEventListener('dragover', (event) => {
        if (!dragSpaceId) return;
        if (event.target.closest('.workspace-rail-btn--space, .rail-folder-stack')) return;
        if (folder.spaceIds.includes(dragSpaceId)) return;
        event.preventDefault();
        wrap.classList.add('is-folder-drop');
        railDropHint = { mode: 'folder', spaceId: folder.spaceIds[0], folderId: folder.id };
      });
      wrap.addEventListener('dragleave', (event) => {
        if (!wrap.contains(event.relatedTarget)) wrap.classList.remove('is-folder-drop');
      });
      wrap.addEventListener('drop', (event) => {
        if (event.target.closest('.workspace-rail-btn--space, .rail-folder-stack')) return;
        event.preventDefault();
        event.stopPropagation();
        wrap.classList.remove('is-folder-drop');
        const fromId =
          dragSpaceId ||
          event.dataTransfer.getData('application/x-relay-space') ||
          event.dataTransfer.getData('text/plain');
        clearRailDragHints();
        if (!fromId || folder.spaceIds.includes(fromId)) return;
        addSpaceToFolder(folder.id, fromId);
        renderSpaceRail(spaceCatalog);
      });
      wrap.addEventListener('contextmenu', (event) => {
        if (event.target.closest('.workspace-rail-btn--space')) return;
        event.preventDefault();
        showFolderMenu(folder.id, event.clientX, event.clientY);
      });

      return wrap;
    };

    const railItems = [];
    for (const space of orderedVisibleSpaces(spaceCatalog)) {
      const folder = folderBySpace.get(space.spaceId);
      if (folder) {
        if (renderedFolders.has(folder.id)) continue;
        renderedFolders.add(folder.id);
        railItems.push({ type: 'folder', folder, beforeId: folder.spaceIds[0] || null });
        continue;
      }
      railItems.push({ type: 'space', space, beforeId: space.spaceId });
    }

    for (const item of railItems) {
      if (item.type === 'folder') {
        spaceRailList.appendChild(buildFolderEl(item.folder));
      } else {
        spaceRailList.appendChild(buildSpaceBtn(item.space));
      }
    }
    ensureRailDropMarker();

    syncWorkspaceRailSelection();
  }

  let logoutConfirmPromise = null;
  async function confirmLoggedOut() {
    if (!loginView.hidden && chatView.hidden) return true;
    if (logoutConfirmPromise) return logoutConfirmPromise;
    logoutConfirmPromise = (async () => {
      try {
        const session = await api('/api/session');
        if (session?.connected) return false;
        showLogin('confirmLoggedOut:session-disconnected');
        return true;
      } catch {
        // Server briefly unavailable (restart) — don't bounce to login.
        return false;
      } finally {
        logoutConfirmPromise = null;
      }
    })();
    return logoutConfirmPromise;
  }

  async function refreshSpaces() {
    try {
      const data = await api('/api/spaces');
      renderSpaceRail(data.spaces || []);
    } catch (error) {
      if (String(error.message).includes('Not logged in')) {
        void confirmLoggedOut();
      }
    }
  }

  workspaceRail.addEventListener('click', (event) => {
    const button = event.target.closest('[data-space]');
    if (!button || button.classList.contains('workspace-rail-btn--space')) return;
    const space = button.dataset.space;
    setSpaceFilter(space, { openFirst: space === 'dms' });
  });

  // Drag a space out of a folder onto empty rail chrome → remove from folder
  // (and dissolve the folder if only one space would remain).
  const isSpaceFolderDropTarget = (event) =>
    Boolean(
      event.target.closest('.workspace-rail-btn--space, .rail-folder, .rail-folder-stack'),
    );

  const acceptUngroupDrag = (event) => {
    const fromId = dragSpaceId;
    if (!fromId || !findSpaceFolder(fromId)) return false;
    if (isSpaceFolderDropTarget(event)) return false;
    return true;
  };

  const clearUngroupDropHint = () => {
    spaceRailList.classList.remove('is-ungroup-drop');
    workspaceRail.classList.remove('is-ungroup-drop');
  };

  const handleUngroupDrop = (event) => {
    if (!acceptUngroupDrag(event)) return;
    event.preventDefault();
    clearUngroupDropHint();
    const fromId =
      dragSpaceId ||
      event.dataTransfer.getData('application/x-relay-space') ||
      event.dataTransfer.getData('text/plain');
    if (!fromId || !findSpaceFolder(fromId)) return;
    removeSpaceFromFolder(fromId);
    renderSpaceRail(spaceCatalog);
  };

  spaceRailList?.addEventListener('dragover', (event) => {
    if (!dragSpaceId) return;
    if (isSpaceFolderDropTarget(event)) {
      clearUngroupDropHint();
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (acceptUngroupDrag(event)) {
      spaceRailList.classList.add('is-ungroup-drop');
      spaceRailList.querySelector('.rail-drop-line')?.classList.remove('is-active');
      return;
    }
    clearUngroupDropHint();
    updateRailGapDropHint(event.clientY);
  });

  spaceRailList?.addEventListener('dragleave', (event) => {
    if (event.target === spaceRailList) {
      spaceRailList.classList.remove('is-ungroup-drop');
      spaceRailList.querySelector('.rail-drop-line')?.classList.remove('is-active');
    }
  });

  spaceRailList?.addEventListener('drop', (event) => {
    if (isSpaceFolderDropTarget(event)) return;
    if (acceptUngroupDrag(event)) {
      handleUngroupDrop(event);
      return;
    }
    if (!dragSpaceId || !railDropHint.mode || !railDropHint.spaceId) return;
    event.preventDefault();
    const fromId =
      dragSpaceId ||
      event.dataTransfer.getData('application/x-relay-space') ||
      event.dataTransfer.getData('text/plain');
    const hint = { ...railDropHint };
    clearRailDragHints();
    if (!fromId) return;
    commitSpaceDrop(fromId, hint);
    renderSpaceRail(spaceCatalog);
  });

  workspaceRail?.addEventListener('dragover', (event) => {
    if (!acceptUngroupDrag(event)) {
      clearUngroupDropHint();
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    workspaceRail.classList.add('is-ungroup-drop');
  });
  workspaceRail?.addEventListener('dragleave', (event) => {
    if (event.target === workspaceRail) workspaceRail.classList.remove('is-ungroup-drop');
  });
  workspaceRail?.addEventListener('drop', handleUngroupDrop);

  showHiddenSpacesBtn.addEventListener('click', () => {
    const hidden = [...getHiddenSpaces()];
    if (hidden.length === 0) return;
    const choice = window.prompt(
      `Hidden spaces (${hidden.length}). Enter a space ID to unhide, or type ALL:`,
      'ALL',
    );
    if (!choice) return;
    if (choice.trim().toUpperCase() === 'ALL') {
      setHiddenSpaces([]);
    } else {
      const next = getHiddenSpaces();
      next.delete(choice.trim());
      setHiddenSpaces(next);
    }
    renderSpaceRail(spaceCatalog);
  });

  document.addEventListener('click', (event) => {
    if (!spaceContextMenu.hidden && !spaceContextMenu.contains(event.target)) {
      hideSpaceMenu();
    }
    if (
      folderContextMenu &&
      !folderContextMenu.hidden &&
      !folderContextMenu.contains(event.target)
    ) {
      hideFolderMenu();
    }
    if (
      !roomContextMenu.hidden &&
      !roomContextMenu.contains(event.target) &&
      !event.target.closest('.room-more') &&
      !event.target.closest('#roomMoreBtn')
    ) {
      hideRoomMenu();
    }
    if (
      messageContextMenu &&
      !messageContextMenu.hidden &&
      !messageContextMenu.contains(event.target) &&
      !event.target.closest('.message-toolbar, .message-more')
    ) {
      hideMessageMenu();
    }
    if (
      !userProfileCard.hidden &&
      !userProfileCard.contains(event.target) &&
      !event.target.closest('.message-avatar-wrap')
    ) {
      hideUserProfile();
    }
    if (
      !accountMenu.hidden &&
      !accountMenu.contains(event.target) &&
      !railAccountBtn.contains(event.target)
    ) {
      hideAccountMenu();
    }
    if (
      railAddMenu &&
      !railAddMenu.hidden &&
      !railAddMenu.contains(event.target) &&
      !event.target.closest('#railAddBtn')
    ) {
      hideRailAddMenu();
    }
    if (
      roomPinsPanel &&
      !roomPinsPanel.hidden &&
      !roomPinsPanel.contains(event.target) &&
      !event.target.closest('#roomPinsBtn')
    ) {
      hideRoomPinsPanel();
    }
    if (
      roomThreadsPanel &&
      !roomThreadsPanel.hidden &&
      !roomThreadsPanel.contains(event.target) &&
      !event.target.closest('#roomThreadsBtn')
    ) {
      hideRoomThreadsPanel();
    }
    if (
      composerPicker &&
      !composerPicker.hidden &&
      !composerPicker.contains(event.target) &&
      !event.target.closest('#composerEmojiBtn, #composerGifBtn')
    ) {
      closeComposerPanels();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Shift') document.body.classList.add('shift-held');
    if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'k') {
      if (!chatView?.hidden) {
        event.preventDefault();
        if (isQuickSwitcherOpen()) closeQuickSwitcher();
        else void openQuickSwitcher();
      }
      return;
    }
    if (event.key === 'Escape') {
      if (isQuickSwitcherOpen()) {
        closeQuickSwitcher();
        return;
      }
      hideSpaceMenu();
      hideFolderMenu();
      hideRoomMenu();
      hideMessageMenu();
      hideUserProfile();
      hideAccountMenu();
      hideRailAddMenu();
      hideRoomPinsPanel();
      hideRoomThreadsPanel();
      if (sharedMediaOpen) setSharedMediaOpen(false);
      closeMessageSearch();
      closeCreateChat();
    }
  });

  document.addEventListener('keyup', (event) => {
    if (event.key === 'Shift') document.body.classList.remove('shift-held');
  });
  window.addEventListener('blur', () => {
    document.body.classList.remove('shift-held');
  });

  userProfileShareBtn.addEventListener('click', async () => {
    if (!profileUser?.permalink) return;
    try {
      await navigator.clipboard.writeText(profileUser.permalink);
      userProfileShareBtn.textContent = 'Copied';
      setTimeout(() => {
        userProfileShareBtn.innerHTML = '<span aria-hidden="true">🔗</span> Share';
      }, 1200);
    } catch (error) {
      window.alert(error.message || String(error));
    }
  });

  userProfileMessageBtn.addEventListener('click', async () => {
    if (!profileUser?.userId || profileUser.isSelf) return;
    try {
      userProfileMessageBtn.disabled = true;
      const result = await api('/api/profile/dm', {
        method: 'POST',
        body: JSON.stringify({ userId: profileUser.userId }),
      });
      hideUserProfile();
      await setSpaceFilter('dms', { openFirst: false });
      activeRoomId = result.roomId;
      persistLastRoom(result.roomId);
      composerForm.hidden = false;
      clearMentions();
      await refreshRooms();
      const room = roomCatalog.find((entry) => entry.roomId === result.roomId);
      updateTimelineHead(
        room || {
          roomId: result.roomId,
          name: profileUser.displayName || 'Direct message',
          isDirect: true,
          dmUserId: profileUser.userId,
        },
      );
      await refreshMessages(result.roomId);
    } catch (error) {
      window.alert(error.message || String(error));
    } finally {
      userProfileMessageBtn.disabled = false;
      if (profileUser && !profileUser.isSelf) {
        userProfileMessageBtn.innerHTML = '<span aria-hidden="true">💬</span> Message';
      }
    }
  });

  userProfileMoreBtn.addEventListener('click', () => {
    if (!profileUser?.userId) return;
    addMention({
      userId: profileUser.userId,
      displayName: profileUser.displayName,
    });
    hideUserProfile();
  });

  spaceContextMenu.addEventListener('click', async (event) => {
    const item = event.target.closest('[data-action]');
    if (!item || item.disabled || !contextSpaceId) return;
    const action = item.dataset.action;
    const spaceId = contextSpaceId;
    const space = spaceCatalog.find((entry) => entry.spaceId === spaceId);
    hideSpaceMenu();

    try {
      if (action === 'mark-read') {
        await api(`/api/spaces/${encodeURIComponent(spaceId)}/read`, {
          method: 'POST',
          body: '{}',
        });
        await refreshSpaces();
      } else if (action === 'hide') {
        const next = getHiddenSpaces();
        next.add(spaceId);
        setHiddenSpaces(next);
        if (activeSpaceFilter === spaceId) setSpaceFilter('dms');
        renderSpaceRail(spaceCatalog);
      } else if (action === 'new-folder') {
        window.alert('Drag a space onto another space to create a folder.');
      } else if (action === 'add-to-folder') {
        const folders = getSpaceFolders();
        if (!folders.length) {
          window.alert('Create a folder first (right-click a space → New Folder).');
          return;
        }
        const choices = folders.map((folder, index) => `${index + 1}. ${folder.name}`).join('\n');
        const pick = window.prompt(`Add to folder:\n${choices}\n\nEnter number:`, '1');
        const index = Number(pick) - 1;
        if (!Number.isFinite(index) || index < 0 || index >= folders.length) return;
        addSpaceToFolder(folders[index].id, spaceId);
        renderSpaceRail(spaceCatalog);
      } else if (action === 'remove-from-folder') {
        removeSpaceFromFolder(spaceId);
        renderSpaceRail(spaceCatalog);
      } else if (action === 'invite') {
        openInviteDialog({ kind: 'space', id: spaceId, name: space?.name || 'space' });
      } else if (action === 'copy-link') {
        const link = space?.permalink || `https://matrix.to/#/${spaceId}`;
        await navigator.clipboard.writeText(link);
      } else if (action === 'settings') {
        const summary = await api(`/api/spaces/${encodeURIComponent(spaceId)}`);
        spaceSettingsTitle.textContent = summary.name || 'Space Settings';
        spaceSettingsTopic.textContent = summary.topic || 'No topic set.';
        spaceSettingsId.value = summary.spaceId;
        spaceSettingsLink.value = summary.permalink;
        if (typeof spaceSettingsDialog.showModal === 'function') {
          spaceSettingsDialog.showModal();
        }
      } else if (action === 'leave') {
        if (!window.confirm(`Leave ${space?.name || 'this space'}?`)) return;
        await api(`/api/spaces/${encodeURIComponent(spaceId)}/leave`, {
          method: 'POST',
          body: '{}',
        });
        if (activeSpaceFilter === spaceId) setSpaceFilter('dms');
        await refreshSpaces();
        await refreshRooms();
      }
    } catch (error) {
      const message = error.message || String(error);
      window.alert(message.replace(/^MatrixError:\s*/i, ''));
    }
  });

  folderContextMenu?.addEventListener('click', (event) => {
    const item = event.target.closest('[data-folder-action]');
    if (!item || !contextFolderId) return;
    const action = item.dataset.folderAction;
    const folderId = contextFolderId;
    const folder = findFolderById(folderId);
    hideFolderMenu();
    if (!folder) return;

    if (action === 'rename') {
      const name = window.prompt('Folder name', folder.name || 'Folder');
      if (!name || !name.trim()) return;
      updateSpaceFolder(folderId, { name: name.trim() });
      renderSpaceRail(spaceCatalog);
    } else if (action === 'toggle') {
      updateSpaceFolder(folderId, { collapsed: !folder.collapsed });
      renderSpaceRail(spaceCatalog);
    } else if (action === 'ungroup') {
      ungroupSpaceFolder(folderId);
      renderSpaceRail(spaceCatalog);
    }
  });

  roomContextMenu.addEventListener('click', async (event) => {
    const item = event.target.closest('[data-room-action]');
    if (!item || item.disabled || !contextRoomId) return;
    const action = item.dataset.roomAction;
    const roomId = contextRoomId;
    const room = roomCatalog.find((entry) => entry.roomId === roomId);
    hideRoomMenu();

    try {
      if (action === 'mark-read') {
        clearRoomNotifications(roomId);
        zeroLocalUnread(roomId);
        await api(`/api/rooms/${encodeURIComponent(roomId)}/read`, {
          method: 'POST',
          body: '{}',
        });
        await refreshRooms();
      } else if (action === 'notifications' || action === 'notif-all' || action === 'notif-mentions' || action === 'notif-mute') {
        const level =
          action === 'notif-mentions'
            ? 'mentions'
            : action === 'notif-mute'
              ? 'mute'
              : action === 'notif-all'
                ? 'all'
                : getRoomNotifLevel(roomId) === 'mute'
                  ? 'all'
                  : 'mute';
        await setRoomNotifLevel(roomId, level);
        const label =
          level === 'mute' ? 'muted' : level === 'mentions' ? 'mentions only' : 'all messages';
        window.alert(`Notifications for ${room?.name || 'this room'}: ${label}`);
      } else if (action === 'invite') {
        openInviteDialog({ kind: 'room', id: roomId, name: room?.name || 'room' });
      } else if (action === 'copy-link') {
        const link = room?.permalink || `https://matrix.to/#/${roomId}`;
        await navigator.clipboard.writeText(link);
      } else if (action === 'settings') {
        const summary = await api(`/api/rooms/${encodeURIComponent(roomId)}`);
        roomSettingsRoomId = summary.roomId;
        roomSettingsTitle.textContent = summary.name || 'Room Settings';
        roomSettingsMeta.textContent = [
          summary.isDirect ? 'Direct message' : 'Room',
          summary.encrypted ? 'encrypted' : 'unencrypted',
          summary.online ? 'online' : null,
        ]
          .filter(Boolean)
          .join(' · ');
        if (roomSettingsName) roomSettingsName.value = summary.name || '';
        if (roomSettingsTopic) roomSettingsTopic.value = summary.topic || '';
        if (roomSettingsJoinRule) {
          roomSettingsJoinRule.value = summary.joinRule || summary.join_rule || 'invite';
        }
        if (roomSettingsError) {
          roomSettingsError.hidden = true;
          roomSettingsError.textContent = '';
        }
        roomSettingsId.value = summary.roomId;
        roomSettingsLink.value = summary.permalink;
        if (typeof roomSettingsDialog.showModal === 'function') {
          roomSettingsDialog.showModal();
        }
      } else if (action === 'add-subroom') {
        openCreateChildDialog({ parentRoomId: roomId, kind: 'subroom' });
      } else if (action === 'leave') {
        if (!window.confirm(`Leave ${room?.name || 'this room'}?`)) return;
        await api(`/api/rooms/${encodeURIComponent(roomId)}/leave`, {
          method: 'POST',
          body: '{}',
        });
        if (activeRoomId === roomId) {
          activeRoomId = null;
          if (localStorage.getItem('relay.lastRoomId') === roomId) {
            localStorage.removeItem('relay.lastRoomId');
            localStorage.removeItem('relay.lastRoomSpace');
          }
          clearTimelineHead();
          messageList.innerHTML = '';
          composerForm.hidden = true;
          setMembersPanelOpen(false);
          updateCallChrome();
        }
        await refreshRooms();
      }
    } catch (error) {
      const message = error.message || String(error);
      window.alert(message.replace(/^MatrixError:\s*/i, ''));
    }
  });

  messageContextMenu?.addEventListener('click', async (event) => {
    const reactBtn = event.target.closest('[data-message-react]');
    if (reactBtn && contextMessage) {
      const key = reactBtn.dataset.messageReact;
      const target = contextMessage;
      hideMessageMenu();
      try {
        await toggleMessageReaction(target.roomId, target.eventId, key);
      } catch (error) {
        window.alert((error.message || String(error)).replace(/^MatrixError:\s*/i, ''));
      }
      return;
    }

    const item = event.target.closest('[data-message-action]');
    if (!item || item.disabled || !contextMessage) return;
    const action = item.dataset.messageAction;
    const target = contextMessage;
    hideMessageMenu();

    try {
      if (action === 'add-reaction') {
        openReactionPicker(target.roomId, target.eventId);
      } else if (action === 'reply') {
        setPendingReply(target, { thread: false });
      } else if (action === 'reply-thread') {
        setPendingReply(target, { thread: true });
      } else if (action === 'edit') {
        setPendingEdit(target);
      } else if (action === 'receipts') {
        openMessageReceiptsDialog(target);
      } else if (action === 'forward') {
        openForwardDialog(target);
      } else if (action === 'view-source') {
        let source = target.source;
        if (!source) {
          source = await api(
            `/api/rooms/${encodeURIComponent(target.roomId)}/messages/${encodeURIComponent(target.eventId)}/source`,
          );
        }
        if (messageSourceBody) {
          messageSourceBody.textContent = JSON.stringify(source, null, 2);
        }
        if (typeof messageSourceDialog?.showModal === 'function') messageSourceDialog.showModal();
      } else if (action === 'copy') {
        if (!target.body) return;
        await navigator.clipboard.writeText(target.body);
      } else if (action === 'copy-link') {
        const link = `https://matrix.to/#/${target.roomId}/${target.eventId}`;
        await navigator.clipboard.writeText(link);
      } else if (action === 'pin') {
        const path = target.isPinned ? 'unpin' : 'pin';
        const result = await api(
          `/api/rooms/${encodeURIComponent(target.roomId)}/pins/${encodeURIComponent(target.eventId)}/${path}`,
          { method: 'POST', body: '{}' },
        );
        updatePinsBadge(result.pinnedCount);
        lastMessagesFingerprint = '';
        lastMessagesContentFingerprint = '';
        await refreshMessages(target.roomId, { quiet: true });
        void refreshRooms();
      } else if (action === 'delete') {
        if (!target.canRedact) return;
        if (!window.confirm('Delete this message for everyone?')) return;
        const eventId = target.eventId;
        const roomId = target.roomId;
        applyOptimisticRedaction(eventId);
        try {
          await api(
            `/api/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(eventId)}/redact`,
            {
              method: 'POST',
              body: '{}',
            },
          );
        } catch (error) {
          lastMessagesFingerprint = '';
          lastMessagesContentFingerprint = '';
          await refreshMessages(roomId, { quiet: true });
          throw error;
        }
        lastMessagesFingerprint = '';
        lastMessagesContentFingerprint = '';
        void refreshMessages(roomId, { quiet: true });
      }
    } catch (error) {
      const message = error.message || String(error);
      window.alert(message.replace(/^MatrixError:\s*/i, ''));
    }
  });

  composerReplyCancel?.addEventListener('click', () => clearPendingReply());
  composerEditCancel?.addEventListener('click', () => {
    clearPendingEdit();
    if (composerInput) {
      composerInput.value = '';
      autosizeComposer();
    }
  });

  async function refreshRooms() {
    try {
      const data = await api(`/api/rooms?space=${encodeURIComponent(activeSpaceFilter)}`);
      syncSpaceFilterHeading();

      const groups = Array.isArray(data.groups) ? data.groups : [];
      roomSidebarGroups = groups;
      lobbySpaceSummary = data.space || null;
      updateSpaceLobbyBtnLabel(Boolean(lobbySpaceSummary?.isForum));
      if (lobbySpaceSummary?.spaceId && lobbySpaceSummary?.name) {
        spaceNameCache.set(lobbySpaceSummary.spaceId, lobbySpaceSummary.name);
      }
      for (const group of groups) {
        if (group?.id && group?.name) spaceNameCache.set(group.id, group.name);
        for (const item of group.items || []) {
          if (item?.type === 'subspace' && item.spaceId && item.name) {
            spaceNameCache.set(item.spaceId, item.name);
          }
        }
      }
      const parents = Array.isArray(data.parents) ? data.parents : [];
      for (const parent of parents) {
        if (parent?.spaceId && parent?.name) {
          spaceNameCache.set(parent.spaceId, parent.name);
        }
      }
      if (spaceBackBtn) {
        const parent = parents[0];
        if (parent?.spaceId && String(activeSpaceFilter).startsWith('!')) {
          spaceBackBtn.hidden = false;
          spaceBackBtn.title = `Back to ${parent.name || 'parent space'}`;
          spaceBackBtn.setAttribute(
            'aria-label',
            `Back to ${parent.name || 'parent space'}`,
          );
          spaceBackBtn.onclick = () =>
            setSpaceFilter(parent.spaceId, { openFirst: false });
        } else {
          spaceBackBtn.hidden = true;
          spaceBackBtn.onclick = null;
        }
      }
      let rooms = (data.rooms || []).slice();
      if (!groups.length) {
        rooms.sort((a, b) => {
          const aVoice = collectVoiceMembersForRoom(a).length > 0 ? 1 : 0;
          const bVoice = collectVoiceMembersForRoom(b).length > 0 ? 1 : 0;
          if (bVoice !== aVoice) return bVoice - aVoice;
          return (b.lastEventTs || 0) - (a.lastEventTs || 0);
        });
      }
      roomCatalog = rooms;
      if (pendingOpenFirstDm && !activeRoomId && activeSpaceFilter === 'dms' && rooms.length) {
        const first =
          rooms.find((entry) => entry?.roomId && entry?.isDirect) ||
          rooms.find((entry) => entry?.roomId);
        if (first?.roomId) {
          pendingOpenFirstDm = false;
          // Defer so this refreshRooms call can finish rendering the list first.
          queueMicrotask(() => openRoomEntry(first));
        }
      }
      if (activeRoomId) {
        const active = rooms.find((entry) => entry.roomId === activeRoomId);
        if (active) updateTimelineHead(active);
      }
      roomList.innerHTML = '';

      const appendRoomRow = (room, { nested = false, showAvatar = false, depth = 0, hideIcon = false } = {}) => {
        const li = document.createElement('li');
        li.className = 'room-row-item';
        // Only im.paarrot.sub_rooms depth indents; folder membership alone does not.
        const nestDepth = Math.max(0, Number(depth) || 0);
        const row = document.createElement('div');
        row.className = `room-item${nestDepth > 0 ? ' room-item--nested' : ''}${room.roomId === activeRoomId ? ' active' : ''}`;
        if (nestDepth > 0) row.style.setProperty('--room-nest-depth', String(nestDepth));
        row.setAttribute('role', 'button');
        row.tabIndex = 0;
        row.title = room.name;

        const name = document.createElement('span');
        name.className = 'room-name';
        name.textContent = room.name;

        const hasAvatarUrl = room.hasAvatar !== false && Boolean(room.avatarUrl);
        const useAvatar = !hideIcon && (showAvatar || hasAvatarUrl);
        const showIcon = !hideIcon && !useAvatar;
        row.classList.toggle('room-item--icon', showIcon);
        row.classList.toggle('room-item--no-icon', hideIcon);

        const media = document.createElement('span');
        media.className = 'room-media';

        if (room.online) {
          const online = document.createElement('span');
          online.className = 'room-online';
          online.title = 'Online';
          online.setAttribute('aria-label', 'Online');
          media.appendChild(online);
          media.classList.add('room-media--online');
        }

        const showFallback = () => {
          media.querySelector('.room-avatar')?.remove();
          if (media.querySelector('.room-avatar-fallback, .room-hash-icon')) return;
          const fallback = document.createElement('span');
          fallback.className = 'room-avatar-fallback';
          fallback.textContent = initials(room.name);
          media.appendChild(fallback);
        };

        // Paarrot RoomNavItem: avatar when DM (showAvatar) or room has avatarUrl; else RoomIcon by join rule.
        if (useAvatar) {
          if (hasAvatarUrl) {
            const img = document.createElement('img');
            img.className = 'room-avatar';
            img.alt = '';
            img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';
            img.addEventListener('error', showFallback, { once: true });
            img.src = room.avatarUrl;
            media.appendChild(img);
          } else {
            const fallback = document.createElement('span');
            fallback.className = 'room-avatar-fallback';
            fallback.textContent = initials(room.name);
            media.appendChild(fallback);
          }
          row.appendChild(media);
        } else if (showIcon) {
          const icon = document.createElement('span');
          icon.className = 'room-hash-icon';
          icon.setAttribute('aria-hidden', 'true');
          icon.innerHTML = `<svg class="ui-icon ui-icon--stroke" viewBox="0 0 24 24">${roomJoinRuleIconSvg(room.joinRule)}</svg>`;
          media.appendChild(icon);
          row.appendChild(media);
        } else if (room.online) {
          // Keep presence visible even when icons are hidden.
          row.appendChild(media);
        }

        row.appendChild(name);

        if (room.unread > 0) {
          const badge = document.createElement('span');
          badge.className = 'room-unread';
          badge.textContent = room.unread > 99 ? '99+' : String(room.unread);
          row.appendChild(badge);
        }

        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'room-more';
        more.title = 'Room options';
        more.setAttribute('aria-label', `Options for ${room.name}`);
        more.textContent = '⋯';
        more.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const rect = more.getBoundingClientRect();
          showRoomMenu(room.roomId, rect.right - 8, rect.bottom + 4, more);
        });
        row.appendChild(more);

        const openRoom = () => openRoomEntry(room);

        row.addEventListener('click', (event) => {
          if (event.target.closest('.room-more')) return;
          openRoom();
        });
        row.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openRoom();
          }
        });
        row.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          showRoomMenu(room.roomId, event.clientX, event.clientY, more);
        });
        li.appendChild(row);
        appendVoiceParticipants(li, room);
        roomList.appendChild(li);
      };

      const appendSubspaceRow = (subspace, { nested = false } = {}) => {
        const li = document.createElement('li');
        li.className = 'room-row-item';
        const row = document.createElement('div');
        row.className = `room-item room-item--subspace${nested ? ' room-item--nested' : ''}`;
        row.setAttribute('role', 'button');
        row.tabIndex = 0;
        row.title = `Open subspace ${subspace.name}`;

        const name = document.createElement('span');
        name.className = 'room-name';
        name.textContent = subspace.name;

        const showFallback = () => {
          row.querySelector('.room-avatar')?.remove();
          if (row.querySelector('.room-avatar-fallback')) return;
          const fallback = document.createElement('span');
          fallback.className = 'room-avatar-fallback';
          fallback.textContent = initials(subspace.name);
          row.insertBefore(fallback, name);
        };

        if (subspace.hasAvatar !== false && subspace.avatarUrl) {
          const img = document.createElement('img');
          img.className = 'room-avatar';
          img.alt = '';
          img.decoding = 'async';
          img.referrerPolicy = 'no-referrer';
          img.addEventListener('error', showFallback, { once: true });
          img.src = subspace.avatarUrl;
          row.appendChild(img);
        } else {
          showFallback();
        }

        row.appendChild(name);

        const hint = document.createElement('span');
        hint.className = 'room-subspace-hint';
        hint.setAttribute('aria-hidden', 'true');
        hint.innerHTML =
          '<svg class="ui-icon ui-icon--stroke" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>';
        row.appendChild(hint);

        if (Number(subspace.unread) > 0) {
          const badge = document.createElement('span');
          badge.className = 'room-unread';
          badge.textContent = subspace.unread > 99 ? '99+' : String(subspace.unread);
          row.appendChild(badge);
        }

        const openSubspace = () => {
          if (subspace.name) spaceNameCache.set(subspace.spaceId, subspace.name);
          setSpaceFilter(subspace.spaceId, { openFirst: false });
        };

        row.addEventListener('click', openSubspace);
        row.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openSubspace();
          }
        });
        li.appendChild(row);
        roomList.appendChild(li);
      };

      const appendGroupHeader = (group) => {
        const closed = isRoomFolderClosed(group.id);
        const li = document.createElement('li');
        li.className = `room-section-item${group.type === 'folder' ? ' room-folder-item' : ''}`;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `room-section${group.type === 'folder' ? ' room-folder' : ''}${closed ? ' is-collapsed' : ''}`;
        btn.setAttribute('aria-expanded', closed ? 'false' : 'true');
        btn.title = closed ? `Expand ${group.name}` : `Collapse ${group.name}`;

        const chevron = document.createElement('span');
        chevron.className = 'room-section-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.textContent = closed ? '▸' : '▾';
        btn.appendChild(chevron);

        if (group.type === 'folder') {
          if (group.hasAvatar !== false && group.avatarUrl) {
            const img = document.createElement('img');
            img.className = 'room-folder-avatar';
            img.alt = '';
            img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';
            img.src = group.avatarUrl;
            img.addEventListener(
              'error',
              () => {
                img.replaceWith(
                  Object.assign(document.createElement('span'), {
                    className: 'room-folder-avatar-fallback',
                    textContent: initials(group.name),
                  }),
                );
              },
              { once: true },
            );
            btn.appendChild(img);
          } else {
            const fallback = document.createElement('span');
            fallback.className = 'room-folder-avatar-fallback';
            fallback.textContent = initials(group.name);
            btn.appendChild(fallback);
          }
        }

        const label = document.createElement('span');
        label.className = 'room-section-label';
        label.textContent = group.name;
        btn.appendChild(label);

        if (group.type === 'folder' && Number(group.unread) > 0 && closed) {
          const badge = document.createElement('span');
          badge.className = 'room-folder-unread';
          badge.textContent = group.unread > 99 ? '99+' : String(group.unread);
          btn.appendChild(badge);
        }

        btn.addEventListener('click', () => {
          setRoomFolderClosed(group.id, !isRoomFolderClosed(group.id));
          void refreshRooms();
        });
        li.appendChild(btn);
        roomList.appendChild(li);
        return !closed;
      };

      if (groups.length) {
        let rendered = 0;
        for (const group of groups) {
          const open = appendGroupHeader(group);
          if (!open) continue;
          const items =
            Array.isArray(group.items) && group.items.length
              ? group.items
              : (group.rooms || []).map((room) => ({ type: 'room', ...room }));
          for (const item of items) {
            const nested = group.type === 'folder';
            if (item?.type === 'subspace') {
              appendSubspaceRow(item, { nested });
              rendered += 1;
            } else {
              const room = item?.type === 'room' ? item : item;
              if (!room?.roomId) continue;
              const depth = Math.max(0, Number(room.depth) || 0);
              appendRoomRow(room, {
                nested: group.type === 'folder',
                depth,
                hideIcon: depth > 0,
                showAvatar: Boolean(room.isDirect),
              });
              rendered += 1;
            }
          }
        }
        if (!rendered && !rooms.length) {
          const empty = document.createElement('li');
          empty.className = 'room-empty';
          empty.textContent = 'No rooms in this space';
          roomList.appendChild(empty);
        }
        if (lobbyOpen && String(activeSpaceFilter).startsWith('!')) renderLobby();
        if (forumOpen && String(activeSpaceFilter).startsWith('!')) void loadForumBoard({ quiet: true });
        return;
      }

      const section = document.createElement('li');
      section.className = 'room-section-item';
      const sectionId = `flat:${activeSpaceFilter}`;
      const sectionClosed = isRoomFolderClosed(sectionId);
      section.innerHTML = `
        <button type="button" class="room-section${sectionClosed ? ' is-collapsed' : ''}" aria-expanded="${sectionClosed ? 'false' : 'true'}">
          <span class="room-section-chevron" aria-hidden="true">${sectionClosed ? '▸' : '▾'}</span>
          <span class="room-section-label"></span>
        </button>
      `;
      section.querySelector('.room-section-label').textContent =
        activeSpaceFilter === 'dms' ? 'Chats' : 'Rooms';
      section.querySelector('.room-section')?.addEventListener('click', () => {
        setRoomFolderClosed(sectionId, !isRoomFolderClosed(sectionId));
        void refreshRooms();
      });
      roomList.appendChild(section);

      if (rooms.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'room-empty';
        empty.textContent =
          activeSpaceFilter === 'dms'
            ? 'No direct messages yet'
            : activeSpaceFilter === 'home'
              ? 'No rooms yet'
              : 'No rooms in this space';
        roomList.appendChild(empty);
        return;
      }

      if (sectionClosed) return;
      for (const room of rooms) {
        appendRoomRow(room, { showAvatar: activeSpaceFilter === 'dms' || Boolean(room.isDirect) });
      }
      if (lobbyOpen && String(activeSpaceFilter).startsWith('!')) renderLobby();
      if (forumOpen && String(activeSpaceFilter).startsWith('!')) void loadForumBoard({ quiet: true });
    } catch (error) {
      if (String(error.message).includes('Not logged in')) {
        void confirmLoggedOut();
      }
    }
  }

  const linkPreviewCache = new Map();
  const LINK_PREVIEW_CACHE_MAX = 120;
  let stickMessagesToBottom = true;
  let messageScrollRoomId = null;
  let scrollingMessagesProgrammatically = false;
  /** @type {ReturnType<typeof setTimeout>[]} */
  let bottomPinTimers = [];

  function isMessageListNearBottom(threshold = 120) {
    return (
      messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < threshold
    );
  }

  function updateJumpToLatestBtn() {
    if (!jumpToLatestBtn || !messageList) return;
    const drawerOpen =
      isMobileUi() && (roomsDrawerOpen || membersPanelOpen || sharedMediaOpen);
    const show =
      Boolean(activeRoomId) &&
      !composerForm?.hidden &&
      !stickMessagesToBottom &&
      !isMessageListNearBottom(160) &&
      !drawerOpen;
    jumpToLatestBtn.hidden = !show;
  }

  function clearBottomPinTimers() {
    for (const timer of bottomPinTimers) clearTimeout(timer);
    bottomPinTimers = [];
  }

  let messagePaintLock = 0;
  let scrollBottomRaf = 0;
  let scrollBottomQueuedForce = false;

  function scrollMessagesToBottom({ force = false } = {}) {
    if (!force && !stickMessagesToBottom) return;
    if (force) {
      stickMessagesToBottom = true;
      scrollBottomQueuedForce = true;
    }
    // Coalesce scroll storms from MutationObserver / image loads / pin timers.
    if (scrollBottomRaf) return;
    scrollBottomRaf = requestAnimationFrame(() => {
      scrollBottomRaf = 0;
      const forced = scrollBottomQueuedForce;
      scrollBottomQueuedForce = false;
      if (!forced && !stickMessagesToBottom) return;
      if (messagePaintLock > 0) {
        stickMessagesToBottom = true;
        scrollBottomQueuedForce = true;
        scrollBottomRaf = requestAnimationFrame(() => {
          scrollBottomRaf = 0;
          scrollMessagesToBottom({ force: true });
        });
        return;
      }
      scrollingMessagesProgrammatically = true;
      stickMessagesToBottom = true;
      const last = messageList.lastElementChild;
      if (last && typeof last.scrollIntoView === 'function') {
        last.scrollIntoView({ block: 'end', inline: 'nearest' });
      }
      messageList.scrollTop = messageList.scrollHeight;
      requestAnimationFrame(() => {
        messageList.scrollTop = messageList.scrollHeight;
        scrollingMessagesProgrammatically = false;
        stickMessagesToBottom = true;
        updateJumpToLatestBtn();
      });
    });
  }

  function pinMessagesToBottom() {
    stickMessagesToBottom = true;
    clearBottomPinTimers();
    scrollMessagesToBottom({ force: true });
    updateJumpToLatestBtn();
    // Composer/layout/previews/images can change height after the first paint.
    for (const delay of [48, 160, 400]) {
      bottomPinTimers.push(
        setTimeout(() => {
          if (!stickMessagesToBottom) return;
          scrollMessagesToBottom({ force: true });
          updateJumpToLatestBtn();
        }, delay),
      );
    }
  }

  messageList.addEventListener('scroll', () => {
    if (scrollingMessagesProgrammatically || messagePaintLock > 0) return;
    stickMessagesToBottom = isMessageListNearBottom();
    updateJumpToLatestBtn();
    if (messageList.scrollTop < 120) {
      void loadOlderMessages();
    }
  });

  jumpToLatestBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    pinMessagesToBottom();
  });

  if (typeof ResizeObserver === 'function') {
    const messageResizeObserver = new ResizeObserver(() => {
      if (messagePaintLock > 0) return;
      // Typing/autosize shrinks the list by ~1px — don't scroll while composing.
      if (document.activeElement === composerInput) return;
      if (stickMessagesToBottom) scrollMessagesToBottom({ force: true });
    });
    messageResizeObserver.observe(messageList);
  }

  // Child content growth (avatars, previews) does not resize the scroller box itself.
  if (typeof MutationObserver === 'function') {
    const messageMutationObserver = new MutationObserver(() => {
      if (messagePaintLock > 0) return;
      if (stickMessagesToBottom) scrollMessagesToBottom({ force: true });
    });
    messageMutationObserver.observe(messageList, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function parseKlipyShareLink(body) {
    const trimmed = String(body || '').trim();
    if (!trimmed) return null;
    if (/^https?:\/\/(?:www\.)?klipy\.com\/gifs\/[a-zA-Z0-9-]+\/?$/i.test(trimmed)) {
      return { kind: 'page', shareUrl: trimmed };
    }
    if (
      /^https?:\/\/static\.klipy\.com\/.+\.(gif|webp|jpg|jpeg|png|mp4|webm)(\?.*)?$/i.test(trimmed)
    ) {
      return { kind: 'static', shareUrl: trimmed, mediaUrl: trimmed };
    }
    return null;
  }

  function mountKlipyEmbed(container, shareUrl) {
    const wrap = document.createElement('div');
    wrap.className = 'klipy-embed';
    const status = document.createElement('div');
    status.className = 'klipy-embed-status';
    status.textContent = 'Loading GIF…';
    wrap.appendChild(status);
    container.appendChild(wrap);

    void (async () => {
      try {
        const data = await api(`/api/gifs/resolve?url=${encodeURIComponent(shareUrl)}`);
        wrap.replaceChildren();
        const img = document.createElement('img');
        img.className = 'klipy-embed-media';
        img.src = data.mediaUrl;
        img.alt = data.title || 'GIF';
        img.loading = 'lazy';
        img.addEventListener('load', () => scrollMessagesToBottom(), { once: true });
        wrap.appendChild(img);
        const open = document.createElement('a');
        open.className = 'klipy-embed-open';
        open.href = data.shareUrl || shareUrl;
        open.target = '_blank';
        open.rel = 'noopener noreferrer';
        open.title = 'Open on Klipy';
        open.textContent = '↗';
        wrap.appendChild(open);
      } catch (error) {
        wrap.replaceChildren();
        const link = document.createElement('a');
        link.href = shareUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = shareUrl;
        wrap.appendChild(link);
      }
    })();
  }

  function extractUrlsFromText(text, limit = 2) {
    if (!text) return [];
    const repaired = repairEmoticonBrokenUrls(text);
    const re = /https?:\/\/[^\s<>"'\u00A0]+/gi;
    const found = [];
    const seen = new Set();
    let match;
    while ((match = re.exec(repaired)) && found.length < limit) {
      let url = match[0].replace(/[),.;:!?\]]+$/g, '');
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
        if (seen.has(parsed.href)) continue;
        seen.add(parsed.href);
        found.push(parsed.href);
      } catch {
        // ignore
      }
    }
    return found;
  }

  function parseYoutubeVideoId(rawUrl) {
    try {
      const parsed = new URL(String(rawUrl || '').trim());
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'youtu.be') {
        return parsed.pathname.split('/').filter(Boolean)[0] || null;
      }
      if (
        host === 'youtube.com' ||
        host === 'm.youtube.com' ||
        host === 'music.youtube.com' ||
        host === 'youtube-nocookie.com'
      ) {
        const fromQuery = parsed.searchParams.get('v');
        if (fromQuery) return fromQuery;
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') {
          return parts[1] || null;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  function parseTikTokVideoId(rawUrl) {
    try {
      const parsed = new URL(String(rawUrl || '').trim());
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
      if (
        host !== 'tiktok.com' &&
        host !== 'm.tiktok.com' &&
        host !== 'vm.tiktok.com' &&
        host !== 'vt.tiktok.com' &&
        !host.endsWith('.tiktok.com')
      ) {
        return null;
      }
      const parts = parsed.pathname.split('/').filter(Boolean);
      const videoIdx = parts.indexOf('video');
      if (videoIdx >= 0 && parts[videoIdx + 1] && /^\d+$/.test(parts[videoIdx + 1])) {
        return parts[videoIdx + 1];
      }
      if (parts[0] === 'v' && parts[1] && /^\d+$/.test(parts[1])) return parts[1];
      if (parts[0] === 'embed') {
        if (parts[1] === 'v2' && parts[2] && /^\d+$/.test(parts[2])) return parts[2];
        if (parts[1] && /^\d+$/.test(parts[1])) return parts[1];
      }
    } catch {
      // ignore
    }
    return null;
  }

  function isJumboEmojiMessage(text) {
    const raw = String(text || '').trim();
    if (!raw) return false;
    // Discord/Paarrot-style: enlarge when the message is only a few emoji.
    const emojiRe =
      /\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*/gu;
    const matches = raw.match(emojiRe);
    if (!matches || matches.length === 0 || matches.length > 6) return false;
    const leftover = raw
      .replace(emojiRe, '')
      .replace(/[\u200D\uFE0F\uFE0E\u20E3]/g, '')
      .replace(/\p{Emoji_Component}/gu, '')
      .replace(/\s+/g, '');
    return leftover.length === 0;
  }

  function extractMessageEmojis(text) {
    const emojiRe =
      /\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*/gu;
    return String(text || '').match(emojiRe) || [];
  }

  let emojiConfettiBusyUntil = 0;

  function resolveJumboEmojiRect(anchorEl) {
    if (!anchorEl) return null;
    const candidates = [
      anchorEl,
      anchorEl.querySelector?.('.message-md'),
      anchorEl.querySelector?.('p'),
      anchorEl.firstElementChild,
    ].filter(Boolean);

    let best = null;
    for (const node of candidates) {
      const rect = node.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) continue;
      // Prefer the tightest box that still looks like the emoji glyph.
      if (!best || rect.width * rect.height < best.area) {
        best = { rect, area: rect.width * rect.height };
      }
    }
    return best?.rect || anchorEl.getBoundingClientRect();
  }

  function burstEmojiConfetti(anchorEl, emojis, { sync = false, targetEventId = null } = {}) {
    const pool = (Array.isArray(emojis) ? emojis : []).filter(Boolean);
    if (!pool.length) return;
    // Short debounce only — later clicks should stack more bursts, not wipe.
    if (Date.now() < emojiConfettiBusyUntil) return;

    const host =
      document.getElementById('chatStage') ||
      document.querySelector('.timeline-pane') ||
      document.getElementById('app') ||
      document.body;
    const hostRect = host.getBoundingClientRect();
    const left = hostRect.left;
    const top = hostRect.top;
    const width = Math.max(1, hostRect.width);
    const height = Math.max(1, hostRect.height);

    let emojiRect = null;
    if (anchorEl) emojiRect = resolveJumboEmojiRect(anchorEl);
    if (!emojiRect || emojiRect.width < 4 || emojiRect.height < 4) {
      const cx = left + width * 0.5;
      const cy = top + height * 0.42;
      emojiRect = { left: cx - 18, top: cy - 18, width: 36, height: 36 };
    }

    const originX = emojiRect.left + emojiRect.width / 2 - left;
    const originY = emojiRect.top + emojiRect.height / 2 - top;
    const baseSize = Math.max(22, Math.min(emojiRect.height * 0.32, 36));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const layer = document.createElement('div');
    layer.className = 'emoji-confetti-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = `left:${left}px;top:${top}px;width:${width}px;height:${height}px;`;
    document.body.appendChild(layer);

    const count = 28;
    const animations = [];
    const chunkSize = 7;
    let index = 0;

    const spawnChunk = () => {
      const end = Math.min(index + chunkSize, count);
      for (; index < end; index += 1) {
        const i = index;
        const piece = document.createElement('span');
        piece.className = 'emoji-confetti-piece';
        piece.textContent = pool[i % pool.length];

        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
        const speed = 140 + Math.random() * 220;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed * 0.75 - (90 + Math.random() * 140);
        const gravity = 520 + Math.random() * 180;
        const duration = 1100 + Math.random() * 400;
        const tPeak = 0.35;
        const tEnd = 1;

        const posAt = (t) => {
          const sec = (duration / 1000) * t;
          return {
            x: originX + vx * sec,
            y: originY + vy * sec + 0.5 * gravity * sec * sec,
          };
        };

        const startDist = Math.max(18, emojiRect.width * 0.2);
        const startX = originX + Math.cos(angle) * startDist * 0.35;
        const startY = originY + Math.sin(angle) * startDist * 0.35;
        const peak = posAt(tPeak);
        const endPos = posAt(tEnd);
        const peakX = clamp(peak.x, -40, width + 40);
        const peakY = clamp(peak.y, -40, height + 40);
        const endX = clamp(endPos.x, -60, width + 60);
        const endY = clamp(endPos.y, -60, height + 80);
        const rot = (i % 2 === 0 ? 1 : -1) * (120 + Math.random() * 220);
        const delay = Math.random() * 28;

        piece.style.fontSize = `${baseSize * (0.8 + Math.random() * 0.45)}px`;
        piece.style.opacity = '0';
        piece.style.transform = `translate3d(${startX}px, ${startY}px, 0) translate(-50%, -50%) scale(0.55)`;
        layer.appendChild(piece);

        animations.push(
          piece.animate(
            [
              {
                transform: `translate3d(${startX}px, ${startY}px, 0) translate(-50%, -50%) scale(0.55) rotate(0deg)`,
                opacity: 0,
              },
              {
                transform: `translate3d(${startX}px, ${startY}px, 0) translate(-50%, -50%) scale(1) rotate(${rot * 0.12}deg)`,
                opacity: 1,
                offset: 0.06,
              },
              {
                transform: `translate3d(${peakX}px, ${peakY}px, 0) translate(-50%, -50%) scale(1.15) rotate(${rot * 0.55}deg)`,
                opacity: 1,
                offset: 0.38,
              },
              {
                transform: `translate3d(${endX}px, ${endY}px, 0) translate(-50%, -50%) scale(0.85) rotate(${rot}deg)`,
                opacity: 0,
              },
            ],
            {
              duration,
              delay,
              easing: 'linear',
              fill: 'both',
            },
          ),
        );
      }

      if (index < count) {
        requestAnimationFrame(spawnChunk);
        return;
      }

      window.setTimeout(() => {
        for (const anim of animations) {
          try {
            anim.cancel();
          } catch {
            // ignore
          }
        }
        layer.remove();
      }, 2800);
    };

    emojiConfettiBusyUntil = Date.now() + 120;
    requestAnimationFrame(spawnChunk);

    if (sync && activeRoomId) {
      void api(`/api/rooms/${encodeURIComponent(activeRoomId)}/emoji-confetti`, {
        method: 'POST',
        body: JSON.stringify({
          emojis: pool.slice(0, 8),
          targetEventId: targetEventId || null,
        }),
      }).catch(() => {
        // Confetti still plays locally even if sync fails (power levels / offline).
      });
    }
  }

  function playRemoteEmojiConfetti({ emojis, targetEventId = null, sender = null } = {}) {
    if (sender && sessionUserId && sender === sessionUserId) return;
    const pool = (Array.isArray(emojis) ? emojis : []).filter(Boolean);
    if (!pool.length) return;

    let anchor = null;
    if (targetEventId && messageList) {
      const article = messageList.querySelector(
        `[data-event-id="${CSS.escape(String(targetEventId))}"]`,
      );
      anchor =
        article?.querySelector('.jumbo-emoji-hit') ||
        article?.querySelector('.body--jumbo-emoji') ||
        article?.querySelector('.body') ||
        article;
    }
    // Bypass local debounce so remote bursts always land.
    emojiConfettiBusyUntil = 0;
    burstEmojiConfetti(anchor, pool, { sync: false });
  }

  function enableJumboEmojiConfetti(bodyEl, text, { eventId = null } = {}) {
    if (!bodyEl || bodyEl.dataset.confettiBound === '1') return;
    const emojis = extractMessageEmojis(text);
    if (!emojis.length) return;

    const hit = document.createElement('button');
    hit.type = 'button';
    hit.className = 'jumbo-emoji-hit';
    hit.tabIndex = -1;
    hit.setAttribute('aria-label', 'Play emoji confetti');
    while (bodyEl.firstChild) hit.appendChild(bodyEl.firstChild);
    bodyEl.appendChild(hit);
    bodyEl.dataset.confettiBound = '1';

    // Keep composer focus — don't steal the caret when bursting.
    hit.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
    hit.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      burstEmojiConfetti(hit, emojis, {
        sync: true,
        targetEventId: eventId || bodyEl.closest('[data-event-id]')?.dataset?.eventId || null,
      });
    });
  }

  function linkifyText(text) {
    const frag = document.createDocumentFragment();
    const source = String(text || '');
    const re = /https?:\/\/[^\s<>"'\u00A0]+/gi;
    let last = 0;
    let match;
    while ((match = re.exec(source))) {
      if (match.index > last) {
        frag.appendChild(document.createTextNode(source.slice(last, match.index)));
      }
      let url = match[0].replace(/[),.;:!?\]]+$/g, '');
      const trailing = match[0].slice(url.length);
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          const anchor = document.createElement('a');
          anchor.className = 'message-link';
          anchor.href = parsed.href;
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          anchor.textContent = url;
          frag.appendChild(anchor);
        } else {
          frag.appendChild(document.createTextNode(match[0]));
        }
      } catch {
        frag.appendChild(document.createTextNode(match[0]));
      }
      if (trailing) frag.appendChild(document.createTextNode(trailing));
      last = match.index + match[0].length;
    }
    if (last < source.length) {
      frag.appendChild(document.createTextNode(source.slice(last)));
    }
    return frag;
  }

  function truncatePreviewText(value, max = 140) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
  }

  function formatPreviewUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.replace(/^www\./, '');
      const path = `${parsed.pathname || ''}${parsed.search || ''}`.replace(/\/$/, '');
      if (!path || path === '') return host;
      const shortPath = path.length > 28 ? `${path.slice(0, 27)}…` : path;
      return `${host}${shortPath}`;
    } catch {
      return truncatePreviewText(rawUrl, 48);
    }
  }

  function buildEmbedMediaChip({ badge, title, subtitle, href }) {
    const fileRow = document.createElement('div');
    fileRow.className = 'message-file-chip';

    const ext = document.createElement('span');
    ext.className = 'message-file-chip-ext';
    ext.textContent = badge;
    fileRow.appendChild(ext);

    const meta = document.createElement('div');
    meta.className = 'message-file-chip-meta';
    const nameEl = document.createElement('span');
    nameEl.className = 'message-file-chip-name';
    nameEl.textContent = title;
    nameEl.title = title;
    meta.appendChild(nameEl);
    if (subtitle) {
      const sub = document.createElement('span');
      sub.className = 'message-file-chip-size';
      sub.textContent = subtitle;
      meta.appendChild(sub);
    }
    fileRow.appendChild(meta);

    if (href) {
      const openBtn = document.createElement('a');
      openBtn.className = 'message-file-chip-download';
      openBtn.href = href;
      openBtn.target = '_blank';
      openBtn.rel = 'noopener noreferrer';
      openBtn.title = 'Open link';
      openBtn.setAttribute('aria-label', `Open ${title}`);
      openBtn.innerHTML = `
        <svg class="ui-icon ui-icon--stroke" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 4h6v6"/>
          <path d="M10 14 20 4"/>
          <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>
        </svg>
      `;
      openBtn.addEventListener('click', (event) => event.stopPropagation());
      fileRow.appendChild(openBtn);
    }

    return fileRow;
  }

  function buildLinkPreviewCard(preview) {
    const youtubeId = preview.youtubeId || parseYoutubeVideoId(preview.url);
    if (youtubeId || preview.mediaType === 'youtube') {
      const wrap = document.createElement('div');
      wrap.className = 'link-preview link-preview--youtube message-video-post';

      wrap.appendChild(
        buildEmbedMediaChip({
          badge: 'YT',
          title: truncatePreviewText(preview.title || 'YouTube', 90),
          subtitle: 'youtube.com',
          href: preview.url,
        }),
      );

      const player = document.createElement('div');
      player.className = 'youtube-player';
      const iframe = document.createElement('iframe');
      // nocookie + modest branding params reduces Error 153 / embed blocks
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?rel=0&modestbranding=1`;
      iframe.title = preview.title || 'YouTube video';
      iframe.loading = 'lazy';
      iframe.allow =
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      player.appendChild(iframe);
      wrap.appendChild(player);
      return wrap;
    }

    const tiktokId = preview.tiktokId || parseTikTokVideoId(preview.url);
    if (tiktokId || preview.mediaType === 'tiktok') {
      const wrap = document.createElement('div');
      wrap.className = 'link-preview link-preview--tiktok message-video-post';
      const openUrl = preview.url || preview.displayUrl;

      wrap.appendChild(
        buildEmbedMediaChip({
          badge: 'TT',
          title: truncatePreviewText(preview.title || 'TikTok', 90),
          subtitle: 'tiktok.com',
          href: openUrl,
        }),
      );

      const player = document.createElement('div');
      player.className = 'tiktok-player';

      if (tiktokId) {
        // Click-to-load keeps timelines light until the user wants audio/video.
        const launch = document.createElement('button');
        launch.type = 'button';
        launch.className = 'tiktok-player-launch';
        launch.setAttribute('aria-label', 'Play TikTok');
        if (preview.image) {
          const thumb = document.createElement('img');
          thumb.className = 'tiktok-player-thumb';
          thumb.alt = '';
          thumb.loading = 'lazy';
          thumb.referrerPolicy = 'no-referrer';
          thumb.src = preview.image;
          launch.appendChild(thumb);
        }
        const play = document.createElement('span');
        play.className = 'tiktok-player-play';
        play.textContent = '▶';
        launch.appendChild(play);
        launch.addEventListener(
          'click',
          () => {
            player.replaceChildren();
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.tiktok.com/embed/v2/${encodeURIComponent(tiktokId)}`;
            iframe.title = preview.title || 'TikTok video';
            iframe.loading = 'lazy';
            iframe.allow = 'encrypted-media; autoplay; clipboard-write; fullscreen; picture-in-picture';
            iframe.allowFullscreen = true;
            iframe.referrerPolicy = 'strict-origin-when-cross-origin';
            player.appendChild(iframe);
          },
          { once: true },
        );
        player.appendChild(launch);
      } else if (preview.image) {
        const thumb = document.createElement('img');
        thumb.className = 'tiktok-player-thumb';
        thumb.alt = '';
        thumb.loading = 'lazy';
        thumb.referrerPolicy = 'no-referrer';
        thumb.src = preview.image;
        player.appendChild(thumb);
      }

      wrap.appendChild(player);
      return wrap;
    }

    const card = document.createElement('a');
    card.className = 'link-preview';
    card.href = preview.url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';

    if (preview.image) {
      const thumb = document.createElement('img');
      thumb.className = 'link-preview-thumb';
      thumb.alt = '';
      thumb.loading = 'lazy';
      thumb.referrerPolicy = 'no-referrer';
      thumb.decoding = 'async';
      thumb.src = preview.image;
      thumb.addEventListener(
        'error',
        () => {
          thumb.remove();
          card.classList.add('link-preview--no-thumb');
        },
        { once: true },
      );
      card.appendChild(thumb);
    } else {
      card.classList.add('link-preview--no-thumb');
    }

    const meta = document.createElement('div');
    meta.className = 'link-preview-meta';

    const urlLine = document.createElement('span');
    urlLine.className = 'link-preview-url';
    urlLine.textContent = formatPreviewUrl(preview.displayUrl || preview.url);
    meta.appendChild(urlLine);

    const title = document.createElement('strong');
    title.className = 'link-preview-title';
    title.textContent = truncatePreviewText(preview.title || preview.siteName || preview.url, 90);
    meta.appendChild(title);

    if (preview.description) {
      const desc = document.createElement('span');
      desc.className = 'link-preview-desc';
      desc.textContent = truncatePreviewText(preview.description, 160);
      meta.appendChild(desc);
    }

    card.appendChild(meta);
    return card;
  }

  async function fetchLinkPreview(url) {
    const cacheKey = `${activeRoomId || ''}::${url}`;
    if (linkPreviewCache.has(cacheKey)) return linkPreviewCache.get(cacheKey);
    const roomQs = activeRoomId
      ? `&roomId=${encodeURIComponent(activeRoomId)}`
      : '';
    const pending = api(`/api/link-preview?url=${encodeURIComponent(url)}${roomQs}`)
      .then((data) => {
        if (data.disabled) {
          linkPreviewCache.set(cacheKey, null);
          return null;
        }
        const preview = data.preview || null;
        linkPreviewCache.set(cacheKey, preview);
        return preview;
      })
      .catch(() => {
        linkPreviewCache.set(cacheKey, null);
        return null;
      });
    if (linkPreviewCache.size >= LINK_PREVIEW_CACHE_MAX) {
      const first = linkPreviewCache.keys().next().value;
      if (first !== undefined) linkPreviewCache.delete(first);
    }
    linkPreviewCache.set(cacheKey, pending);
    return pending;
  }

  async function mountLinkPreviews(container, urls) {
    for (const url of urls) {
      const preview = await fetchLinkPreview(url);
      if (!preview || !container.isConnected) continue;
      const card = buildLinkPreviewCard(preview);
      const thumb = card.querySelector('.link-preview-thumb');
      if (thumb) {
        thumb.addEventListener('load', () => scrollMessagesToBottom(), { once: true });
      }
      container.appendChild(card);
      scrollMessagesToBottom();
    }
    if (!container.children.length && container.isConnected) {
      container.remove();
    }
    scrollMessagesToBottom();
  }

  let lightboxState = null;
  let lightboxZoom = 1;
  let lightboxPanX = 0;
  let lightboxPanY = 0;
  let lightboxDragging = false;

  // Match Paarrot useZoom(0.2) / usePan
  const LIGHTBOX_ZOOM_MIN = 0.1;
  const LIGHTBOX_ZOOM_MAX = 5;
  const LIGHTBOX_ZOOM_STEP = 0.2;

  function mediaProxyUrl(remoteUrl, { download = false, filename = 'image' } = {}) {
    const params = new URLSearchParams({ url: remoteUrl });
    if (download) {
      params.set('download', '1');
      params.set('filename', filename || 'image');
    }
    return `/api/media?${params.toString()}`;
  }

  function formatBytes(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function imageFilenameOf(msg) {
    return msg.imageFilename || 'image.png';
  }

  function mediaCaptionOf(msg) {
    const body = String(msg?.body || '').trim();
    if (!body) return '';
    const filename = String(
      msg?.imageFilename || msg?.videoFilename || msg?.filename || '',
    ).trim();
    if (filename && body === filename) return '';
    if (/^(image|upload|video|file)\.[a-z0-9]+$/i.test(body)) return '';
    return body;
  }

  async function downloadImage(remoteUrl, filename = 'image') {
    const href = mediaProxyUrl(remoteUrl, { download: true, filename });
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function copyTextValue(value) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  function lightboxCanPan() {
    if (!isLightboxOpen()) return false;
    const limits = getLightboxPanLimits();
    return limits.maxX > 0.5 || limits.maxY > 0.5;
  }

  function syncLightboxZoomButtons() {
    imageLightboxZoomOut?.classList.toggle('is-active', lightboxZoom < 0.999);
    imageLightboxZoomIn?.classList.toggle('is-active', lightboxZoom > 1.001);
    if (imageLightboxZoomLabel) {
      imageLightboxZoomLabel.textContent = `${Math.round(lightboxZoom * 100)}%`;
    }
  }

  function getLightboxPanLimits() {
    if (!imageLightboxImg || !imageLightboxStage) {
      return { maxX: 0, maxY: 0 };
    }
    const stage = imageLightboxStage.getBoundingClientRect();
    if (stage.width < 1 || stage.height < 1) {
      return { maxX: 0, maxY: 0 };
    }

    // Layout size ignores CSS transforms — multiply by zoom for on-screen size.
    const baseW = imageLightboxImg.offsetWidth || 0;
    const baseH = imageLightboxImg.offsetHeight || 0;
    const nw = imageLightboxImg.naturalWidth || 0;
    const nh = imageLightboxImg.naturalHeight || 0;

    let dispW = baseW * lightboxZoom;
    let dispH = baseH * lightboxZoom;
    if ((!dispW || !dispH) && nw && nh) {
      const fit = Math.min(stage.width / nw, stage.height / nh);
      dispW = nw * fit * lightboxZoom;
      dispH = nh * fit * lightboxZoom;
    }

    // Hard contain: only pan the overflow. Image can never leave the frame.
    return {
      maxX: Math.max(0, (dispW - stage.width) / 2),
      maxY: Math.max(0, (dispH - stage.height) / 2),
    };
  }

  function clampLightboxPan() {
    const { maxX, maxY } = getLightboxPanLimits();
    lightboxPanX = Math.min(maxX, Math.max(-maxX, lightboxPanX));
    lightboxPanY = Math.min(maxY, Math.max(-maxY, lightboxPanY));
  }

  function applyLightboxTransform() {
    if (!imageLightboxImg) return;
    clampLightboxPan();
    imageLightboxImg.style.transform = `translate(${lightboxPanX}px, ${lightboxPanY}px) scale(${lightboxZoom})`;
    const canPan = lightboxCanPan();
    imageLightboxImg.style.cursor = lightboxDragging
      ? 'grabbing'
      : canPan
        ? 'grab'
        : 'default';
    imageLightboxStage?.classList.toggle('is-zoomed', canPan);
    imageLightboxStage?.classList.toggle('is-panning', lightboxDragging);
    if (imageLightboxStage) {
      imageLightboxStage.style.cursor = lightboxDragging
        ? 'grabbing'
        : canPan
          ? 'grab'
          : 'default';
    }
    syncLightboxZoomButtons();
  }

  function setLightboxZoom(next) {
    const raw = Number(next);
    if (!Number.isFinite(raw)) return;
    const clamped = Math.min(LIGHTBOX_ZOOM_MAX, Math.max(LIGHTBOX_ZOOM_MIN, raw));
    lightboxZoom = Number(clamped.toFixed(2));
    if (Math.abs(lightboxZoom - 1) < 0.001) {
      lightboxZoom = 1;
    }
    // Re-clamp after zoom; don't force pan to 0 unless it fully fits.
    applyLightboxTransform();
  }

  function setLightboxScrollLock(locked) {
    document.documentElement.classList.toggle('lightbox-open', Boolean(locked));
    document.body?.classList.toggle('lightbox-open', Boolean(locked));
  }

  function onLightboxScrollBlock(event) {
    if (!isLightboxOpen()) return;
    event.preventDefault();
    if (!lightboxCanPan()) return;
    const dx = event.shiftKey ? event.deltaY : event.deltaX || 0;
    const dy = event.shiftKey ? 0 : event.deltaY || 0;
    if (!dx && !dy) return;
    lightboxPanX -= dx;
    lightboxPanY -= dy;
    applyLightboxTransform();
  }

  function isLightboxOpen() {
    return Boolean(imageLightbox && !imageLightbox.hidden);
  }

  function openImageLightbox(msg) {
    const full = msg.imageFullUrl || msg.imageUrl;
    if (!full) return;
    const filename = imageFilenameOf(msg);
    lightboxState = {
      url: full,
      previewUrl: msg.imageUrl || full,
      filename,
      mxc: msg.imageMxc || null,
    };
    lightboxZoom = 1;
    lightboxPanX = 0;
    lightboxPanY = 0;
    lightboxDragging = false;
    if (imageLightboxName) {
      imageLightboxName.textContent = filename;
      imageLightboxName.title = filename;
    }
    imageLightboxImg.src = mediaProxyUrl(full);
    imageLightboxImg.alt = filename;
    applyLightboxTransform();
    if (imageLightbox) imageLightbox.hidden = false;
    setLightboxScrollLock(true);
  }

  function closeImageLightbox() {
    if (!imageLightbox) return;
    stopLightboxPan();
    imageLightbox.hidden = true;
    lightboxState = null;
    lightboxDragging = false;
    lightboxZoom = 1;
    lightboxPanX = 0;
    lightboxPanY = 0;
    if (imageLightboxImg) {
      imageLightboxImg.src = '';
      imageLightboxImg.style.transform = '';
      imageLightboxImg.style.cursor = '';
    }
    imageLightboxStage?.classList.remove('is-zoomed', 'is-panning');
    if (imageLightboxName) {
      imageLightboxName.textContent = '';
      imageLightboxName.title = '';
    }
    syncLightboxZoomButtons();
    if (imageLightboxZoomLabel) imageLightboxZoomLabel.textContent = '100%';
    setLightboxScrollLock(false);
  }

  function onLightboxPanMove(event) {
    if (!lightboxDragging) return;
    event.preventDefault();
    // Prefer movementX/Y; fall back for older events
    const dx = event.movementX || 0;
    const dy = event.movementY || 0;
    if (!dx && !dy) return;
    lightboxPanX += dx;
    lightboxPanY += dy;
    applyLightboxTransform();
  }

  function stopLightboxPan(event) {
    if (event) event.preventDefault();
    if (!lightboxDragging) {
      document.removeEventListener('pointermove', onLightboxPanMove);
      document.removeEventListener('pointerup', stopLightboxPan);
      document.removeEventListener('pointercancel', stopLightboxPan);
      return;
    }
    lightboxDragging = false;
    document.removeEventListener('pointermove', onLightboxPanMove);
    document.removeEventListener('pointerup', stopLightboxPan);
    document.removeEventListener('pointercancel', stopLightboxPan);
    if (event?.pointerId != null) {
      try {
        imageLightboxStage?.releasePointerCapture?.(event.pointerId);
      } catch {
        // ignore
      }
    }
    applyLightboxTransform();
  }

  function startLightboxPan(event) {
    if (!isLightboxOpen() || !lightboxCanPan()) return;
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    lightboxDragging = true;
    // Keep dragging even if the cursor leaves the image / stage.
    if (imageLightboxStage?.setPointerCapture && event.pointerId != null) {
      try {
        imageLightboxStage.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }
    document.addEventListener('pointermove', onLightboxPanMove);
    document.addEventListener('pointerup', stopLightboxPan);
    document.addEventListener('pointercancel', stopLightboxPan);
    applyLightboxTransform();
  }

  function buildMessageImage(msg) {
    const figure = document.createElement('figure');
    figure.className = 'message-media';
    const info = msg.imageInfo || {};
    if (info.width && info.height) {
      const ratio = info.height / info.width;
      if (ratio > 0 && Number.isFinite(ratio)) {
        figure.style.setProperty('--media-aspect', String(Math.min(Math.max(ratio, 0.35), 1.8)));
      }
    }

    const frame = document.createElement('button');
    frame.type = 'button';
    frame.className = 'message-media-frame';
    frame.title = msg.imageSpoiler ? 'Reveal spoiler' : 'View image';

    const img = document.createElement('img');
    img.className = 'message-image';
    img.alt = imageFilenameOf(msg);
    img.loading = mediaAutoLoadDisabled() ? 'lazy' : 'eager';
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';

    if (info.blurhash && window.RelayBlurhash?.toDataUrl) {
      const placeholder = window.RelayBlurhash.toDataUrl(info.blurhash, 32, 32);
      if (placeholder) {
        const ph = document.createElement('img');
        ph.className = 'message-image-blurhash';
        ph.alt = '';
        ph.src = placeholder;
        frame.appendChild(ph);
      }
    }

    let spoilerBadge = null;
    const revealImage = () => {
      figure.classList.remove('is-spoiler');
      frame.title = 'View image';
      spoilerBadge?.remove();
      spoilerBadge = null;
    };

    const attachImageSrc = () => {
      img.src = mediaProxyUrl(msg.imageUrl);
      if (!frame.contains(img)) frame.appendChild(img);
    };

    if (mediaAutoLoadDisabled() && !msg.imageSpoiler) {
      figure.classList.add('is-deferred');
      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.className = 'message-media-load';
      loadBtn.textContent = 'Load image';
      loadBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        figure.classList.remove('is-deferred');
        loadBtn.remove();
        attachImageSrc();
      });
      frame.appendChild(loadBtn);
      frame.addEventListener('click', () => {
        if (figure.classList.contains('is-deferred')) return;
        openImageLightbox(msg);
      });
    } else {
      attachImageSrc();
    }

    img.addEventListener(
      'load',
      () => {
        frame.querySelector('.message-image-blurhash')?.remove();
        scrollMessagesToBottom();
      },
      { once: true },
    );
    img.addEventListener(
      'error',
      () => {
        img.src = msg.imageFullUrl || msg.imageUrl;
      },
      { once: true },
    );
    if (!mediaAutoLoadDisabled() || msg.imageSpoiler) {
      // img may already be in frame via attachImageSrc
      if (!frame.contains(img) && !msg.imageSpoiler) frame.appendChild(img);
    }

    if (msg.imageSpoiler) {
      if (!frame.contains(img)) frame.appendChild(img);
      figure.classList.add('is-spoiler');
      spoilerBadge = document.createElement('span');
      spoilerBadge.className = 'message-media-spoiler';
      spoilerBadge.textContent = 'Spoiler — click to reveal';
      frame.appendChild(spoilerBadge);
      frame.addEventListener('click', (event) => {
        if (figure.classList.contains('is-spoiler')) {
          event.preventDefault();
          event.stopPropagation();
          revealImage();
          return;
        }
        openImageLightbox(msg);
      });
    } else if (!mediaAutoLoadDisabled()) {
      frame.addEventListener('click', () => openImageLightbox(msg));
    }

    figure.appendChild(frame);
    return figure;
  }


  function videoExtBadge(filename, mime) {
    const name = String(filename || '').toLowerCase();
    const type = String(mime || '').toLowerCase();
    if (name.endsWith('.mp4') || type.includes('mp4')) return 'MP4';
    if (name.endsWith('.webm') || type.includes('webm')) return 'WEBM';
    if (name.endsWith('.mov') || type.includes('quicktime')) return 'MOV';
    if (name.endsWith('.mkv') || type.includes('matroska')) return 'MKV';
    if (name.endsWith('.ogv') || type.includes('ogg')) return 'OGV';
    const dot = name.lastIndexOf('.');
    if (dot > -1 && dot < name.length - 1) {
      return name.slice(dot + 1, dot + 5).toUpperCase();
    }
    return 'VIDEO';
  }

  function formatMediaBytes(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n < 1024) return `${Math.round(n)} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  }

  function buildMessageVideo(msg) {
    const wrap = document.createElement('div');
    wrap.className = 'message-video-post';

    const filename = msg.videoFilename || msg.body || 'video';
    const remoteUrl = msg.videoFullUrl || msg.videoUrl;
    const info = msg.videoInfo || {};
    const badge = videoExtBadge(filename, info.mimetype);

    const fileRow = document.createElement('div');
    fileRow.className = 'message-file-chip';

    const ext = document.createElement('span');
    ext.className = 'message-file-chip-ext';
    ext.textContent = badge;
    fileRow.appendChild(ext);

    const meta = document.createElement('div');
    meta.className = 'message-file-chip-meta';
    const nameEl = document.createElement('span');
    nameEl.className = 'message-file-chip-name';
    nameEl.textContent = filename;
    nameEl.title = filename;
    meta.appendChild(nameEl);
    const sizeLabel = formatMediaBytes(info.size);
    if (sizeLabel) {
      const sizeEl = document.createElement('span');
      sizeEl.className = 'message-file-chip-size';
      sizeEl.textContent = sizeLabel;
      meta.appendChild(sizeEl);
    }
    fileRow.appendChild(meta);

    if (remoteUrl) {
      const downloadBtn = document.createElement('button');
      downloadBtn.type = 'button';
      downloadBtn.className = 'message-file-chip-download';
      downloadBtn.title = 'Download';
      downloadBtn.setAttribute('aria-label', `Download ${filename}`);
      downloadBtn.innerHTML = `
        <svg class="ui-icon ui-icon--stroke" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4v12"/>
          <path d="m7 11 5 5 5-5"/>
          <path d="M5 20h14"/>
        </svg>
      `;
      downloadBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void downloadImage(remoteUrl, filename);
      });
      fileRow.appendChild(downloadBtn);
    }

    wrap.appendChild(fileRow);

    const figure = document.createElement('figure');
    figure.className = 'message-media message-media--video';
    if (info.width && info.height) {
      const ratio = info.height / info.width;
      if (ratio > 0 && Number.isFinite(ratio)) {
        figure.style.setProperty('--media-aspect', String(Math.min(Math.max(ratio, 0.35), 1.8)));
      }
    }

    const video = document.createElement('video');
    video.className = 'message-video';
    video.controls = true;
    video.playsInline = true;
    video.preload = mediaAutoLoadDisabled() ? 'none' : 'metadata';
    if (!mediaAutoLoadDisabled()) {
      video.src = mediaProxyUrl(remoteUrl);
    } else {
      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.className = 'message-media-load';
      loadBtn.textContent = 'Load video';
      loadBtn.addEventListener('click', () => {
        loadBtn.remove();
        video.src = mediaProxyUrl(remoteUrl);
        video.preload = 'metadata';
      });
      figure.appendChild(loadBtn);
    }
    if (msg.videoPosterUrl) video.poster = mediaProxyUrl(msg.videoPosterUrl);
    video.title = filename;

    const sizeVideoPost = () => {
      const vw = video.videoWidth || Number(info.width) || 0;
      const vh = video.videoHeight || Number(info.height) || 0;
      if (!vw || !vh) return;
      const parentWidth =
        wrap.parentElement?.clientWidth ||
        wrap.closest('.message-main')?.clientWidth ||
        messageList?.clientWidth ||
        480;
      const maxW = Math.min(480, Math.max(200, parentWidth - 8));
      const maxH = 420;
      const scale = Math.min(maxW / vw, maxH / vh, 1);
      const renderW = Math.max(200, Math.round(vw * scale));
      const renderH = Math.max(112, Math.round(vh * scale));
      // Lock card to the video panel width so the file chip can't stretch it.
      wrap.style.width = `${renderW}px`;
      wrap.style.maxWidth = `${renderW}px`;
      wrap.style.minWidth = `${renderW}px`;
      figure.style.width = '100%';
      video.style.width = '100%';
      video.style.height = `${renderH}px`;
    };

    if (info.width && info.height) sizeVideoPost();
    video.addEventListener('loadedmetadata', sizeVideoPost);
    video.addEventListener('loadeddata', () => {
      sizeVideoPost();
      scrollMessagesToBottom();
    }, { once: true });
    figure.appendChild(video);
    wrap.appendChild(figure);
    return wrap;
  }

  function buildMessageGallery(msg) {
    const wrap = document.createElement('div');
    wrap.className = 'message-gallery';
    const items = Array.isArray(msg.gallery) ? msg.gallery : [];
    for (const item of items) {
      wrap.appendChild(
        buildMessageImage({
          ...msg,
          ...item,
          imageUrl: item.imageUrl,
          imageFullUrl: item.imageFullUrl,
          imageMxc: item.imageMxc,
          imageFilename: item.imageFilename,
          imageInfo: item.imageInfo,
          imageSpoiler: item.imageSpoiler,
        }),
      );
    }
    return wrap;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  function clearPendingAttachments() {
    for (const entry of pendingAttachments) {
      if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    }
    pendingAttachments = [];
    renderAttachPreview();
  }

  function removePendingAttachment(id) {
    if (attachmentsUploading) return;
    const index = pendingAttachments.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    const [removed] = pendingAttachments.splice(index, 1);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    renderAttachPreview();
  }

  function renderAttachPreview(statusById = {}) {
    if (!composerAttachPreview) return;
    composerAttachPreview.innerHTML = '';
    if (pendingAttachments.length === 0) {
      composerAttachPreview.hidden = true;
      return;
    }
    composerAttachPreview.hidden = false;
    for (const entry of pendingAttachments) {
      const chip = document.createElement('div');
      chip.className = `composer-attach-chip${attachmentsUploading ? ' is-uploading' : ''}`;
      const img = document.createElement('img');
      img.alt = '';
      img.src = entry.previewUrl;
      const meta = document.createElement('div');
      meta.className = 'composer-attach-chip-meta';
      const name = document.createElement('strong');
      name.textContent = entry.file.name || 'image';
      const info = document.createElement('span');
      info.textContent =
        statusById[entry.id] ||
        formatBytes(entry.file.size) ||
        'Queued — press Send';
      meta.appendChild(name);
      meta.appendChild(info);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.title = 'Remove';
      remove.setAttribute('aria-label', `Remove ${entry.file.name || 'image'}`);
      remove.textContent = '×';
      remove.disabled = attachmentsUploading;
      remove.addEventListener('click', () => removePendingAttachment(entry.id));
      chip.appendChild(img);
      chip.appendChild(meta);
      chip.appendChild(remove);
      composerAttachPreview.appendChild(chip);
    }
  }

  const IMAGE_FILE_EXT = /\.(png|apng|jpe?g|gif|webp|bmp|avif|heic|heif)$/i;
  const VIDEO_FILE_EXT = /\.(webm|mp4|mov|mkv|ogv)$/i;

  function isImageFile(file) {
    if (!file) return false;
    const type = String(file.type || '').toLowerCase();
    if (type.startsWith('image/')) return true;
    if (type === 'application/octet-stream' || !type) {
      return IMAGE_FILE_EXT.test(file.name || '');
    }
    return IMAGE_FILE_EXT.test(file.name || '');
  }

  function isVideoFile(file) {
    if (!file) return false;
    const type = String(file.type || '').toLowerCase();
    if (type.startsWith('video/')) return true;
    if (type === 'application/octet-stream' || !type) {
      return VIDEO_FILE_EXT.test(file.name || '');
    }
    return VIDEO_FILE_EXT.test(file.name || '');
  }

  function isMediaFile(file) {
    return isImageFile(file) || isVideoFile(file);
  }

  function guessImageMime(file) {
    const type = String(file?.type || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (type === 'image/jpg') return 'image/jpeg';
    if (type.startsWith('image/')) return type;
    const name = String(file?.name || '').toLowerCase();
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.apng')) return 'image/apng';
    if (name.endsWith('.gif')) return 'image/gif';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.bmp')) return 'image/bmp';
    if (name.endsWith('.avif')) return 'image/avif';
    if (name.endsWith('.heic') || name.endsWith('.heif')) return 'image/heic';
    return 'image/png';
  }

  function guessVideoMime(file) {
    const type = String(file?.type || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (type.startsWith('video/')) return type;
    const name = String(file?.name || '').toLowerCase();
    if (name.endsWith('.mp4')) return 'video/mp4';
    if (name.endsWith('.mov')) return 'video/quicktime';
    if (name.endsWith('.mkv')) return 'video/x-matroska';
    if (name.endsWith('.ogv')) return 'video/ogg';
    return 'video/webm';
  }

  function createCarouselUuid() {
    if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function stagePendingImages(fileList) {
    const files = [...fileList].filter((file) => isMediaFile(file));
    if (files.length === 0) {
      window.alert('Supported media: PNG, APNG, JPEG, GIF, WebP, BMP, AVIF, WebM, MP4.');
      return;
    }
    for (const file of files) {
      pendingAttachments.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        kind: isVideoFile(file) ? 'video' : 'image',
      });
    }
    renderAttachPreview();
  }

  async function sendPendingAttachments({
    caption = null,
    formatted_body = null,
    mentions = null,
  } = {}) {
    if (!activeRoomId || pendingAttachments.length === 0) return;
    const queue = pendingAttachments.slice();
    attachmentsUploading = true;
    const statusById = {};
    for (const entry of queue) statusById[entry.id] = 'Uploading…';
    renderAttachPreview(statusById);

    const imageQueue = queue.filter((entry) => entry.kind !== 'video' && isImageFile(entry.file));
    const carouselUuid = imageQueue.length > 1 ? createCarouselUuid() : null;
    const captionText = typeof caption === 'string' ? caption.trim() : '';
    let captionUsed = false;

    try {
      let imageIndex = 0;
      for (const entry of queue) {
        statusById[entry.id] = 'Preparing…';
        renderAttachPreview(statusById);
        const dataUrl = await fileToDataUrl(entry.file);
        const isVideo = entry.kind === 'video' || isVideoFile(entry.file);
        const thisCaption = !captionUsed && captionText ? captionText : null;
        if (thisCaption) captionUsed = true;

        if (isVideo) {
          statusById[entry.id] = 'Uploading video…';
          renderAttachPreview(statusById);
          await api(`/api/rooms/${encodeURIComponent(activeRoomId)}/send-video`, {
            method: 'POST',
            body: JSON.stringify({
              dataUrl,
              filename: entry.file.name || 'video.webm',
              contentType: guessVideoMime(entry.file),
              caption: thisCaption,
            }),
          });
        } else {
          let blurhash = null;
          let width = null;
          let height = null;
          try {
            const encoded = await window.RelayBlurhash?.encodeFromBlob?.(entry.file);
            if (encoded?.blurhash) {
              blurhash = encoded.blurhash;
              width = encoded.width || null;
              height = encoded.height || null;
            }
          } catch {
            // continue without blurhash
          }
          statusById[entry.id] = blurhash ? 'Uploading…' : 'Uploading (no blurhash)…';
          renderAttachPreview(statusById);
          const carousel = carouselUuid
            ? { uuid: carouselUuid, index: imageIndex, total: imageQueue.length }
            : null;
          imageIndex += 1;
          await api(`/api/rooms/${encodeURIComponent(activeRoomId)}/send-image`, {
            method: 'POST',
            body: JSON.stringify({
              dataUrl,
              filename: entry.file.name || 'upload.png',
              contentType: guessImageMime(entry.file),
              blurhash,
              width,
              height,
              carousel,
              caption: thisCaption,
              formatted_body: thisCaption ? formatted_body : null,
              mentions: thisCaption ? mentions : null,
            }),
          });
        }
        statusById[entry.id] = 'Sent';
        renderAttachPreview(statusById);
      }
      clearPendingAttachments();
    } catch (error) {
      attachmentsUploading = false;
      renderAttachPreview(
        Object.fromEntries(queue.map((entry) => [entry.id, statusById[entry.id] || 'Failed'])),
      );
      throw error;
    } finally {
      attachmentsUploading = false;
    }
  }

  function setComposerDropActive(active) {
    composerForm.classList.toggle('is-drop-target', active);
    if (composerDropHint) composerDropHint.hidden = !active;
  }

  function applyOptimisticRedaction(eventId) {
    const id = String(eventId || '').trim();
    if (!id || !messageList) return;
    activeRoomMessages = activeRoomMessages.map((msg) =>
      msg.eventId === id
        ? {
            ...msg,
            redacted: true,
            body: null,
            html: null,
            imageUrl: null,
            videoUrl: null,
            gallery: null,
            reactions: [],
            readBy: [],
            canRedact: false,
          }
        : msg,
    );
    const el = messageList.querySelector(`[data-event-id="${CSS.escape(id)}"]`);
    if (!el) return;
    if (!showHiddenEventsEnabled()) {
      const prev = el.previousElementSibling;
      const next = el.nextElementSibling;
      el.remove();
      if (prev?.classList?.contains('timeline-day-sep') && (!next || next.classList.contains('timeline-day-sep') || next.classList.contains('timeline-history-status'))) {
        prev.remove();
      }
      return;
    }
    el.classList.add('message--redacted');
    const body = el.querySelector('.body');
    if (body) body.textContent = 'Message deleted';
    el.querySelector('.message-media')?.remove();
    el.querySelector('.message-gallery')?.remove();
    el.querySelector('.message-reactions')?.remove();
    el.querySelector('.message-receipts')?.remove();
    el.querySelector('.link-preview')?.remove();
    el.querySelector('.message-toolbar')?.remove();
  }

  async function refreshMessages(
    roomId,
    {
      quiet = false,
      pinBottom = false,
      history = false,
      preserveScroll = false,
      limit = null,
      minMessages = null,
      messages: presetMessages = null,
      atStart: presetAtStart = null,
    } = {},
  ) {
    if (!roomId || typeof roomId !== 'string') return;
    // Quiet polls must not interrupt / cancel a room-open history hydrate.
    if (quiet && historyLoadingRoomId === roomId) return;

    const authoritative = history || !quiet;
    const token = authoritative ? ++messageRefreshToken : messageRefreshToken;
    if (history) historyLoadingRoomId = roomId;
    void ensureMarkdown().catch(() => {});
    let paintedMessages = false;
    try {
      let data;
      if (Array.isArray(presetMessages)) {
        data = {
          messages: presetMessages,
          atStart: presetAtStart,
        };
      } else {
        const displayLimit =
          Number(limit) ||
          (history
            ? 500
            : Math.max(200, activeRoomId === roomId ? activeRoomMessages.length || 0 : 0, 200));
        const qs = new URLSearchParams({
          limit: String(Math.min(2500, displayLimit)),
        });
        if (history) {
          qs.set('history', '1');
          qs.set('minEvents', String(Math.max(displayLimit * 2, 400)));
          qs.set(
            'minMessages',
            String(Math.max(Number(minMessages) || 0, displayLimit, 300)),
          );
          if (!quiet && messageList && activeRoomId === roomId) {
            const status = document.createElement('div');
            status.className = 'timeline-history-status';
            status.textContent = 'Loading message history…';
            if (!messageList.querySelector('.timeline-history-status')) {
              messageList.prepend(status);
            }
          }
        }
        data = await api(`/api/rooms/${encodeURIComponent(roomId)}/messages?${qs}`);
      }
      if (activeRoomId !== roomId) return;
      // Authoritative loads bump the token; quiet loads must yield to a newer authoritative one.
      if (authoritative && token !== messageRefreshToken) return;
      if (!authoritative && token !== messageRefreshToken) return;

      const messages = data.messages || [];
      activeRoomMessages = messages;
      if (typeof data.atStart === 'boolean') timelineAtStart = data.atStart;
      const contentFingerprint = `${messages.length}|${messages
        .map(
          (msg) =>
            `${msg.eventId || ''}:${msg.ts || ''}:${msg.redacted ? 1 : 0}:${msg.body || ''}:${msg.imageUrl || ''}:${msg.videoUrl || ''}`,
        )
        .join('|')}`;
      const fingerprint = `${contentFingerprint}|rb:${messages
        .map((msg) => (msg.readBy || []).length)
        .join(',')}`;
      // Quiet polls: skip full rebuild when message content is unchanged, but still
      // patch the Seen by row when receipts move.
      if (
        quiet &&
        !pinBottom &&
        !preserveScroll &&
        !history &&
        messageScrollRoomId === roomId &&
        contentFingerprint === lastMessagesContentFingerprint
      ) {
        if (fingerprint !== lastMessagesFingerprint) {
          activeRoomMessages = messages;
          syncMessageReceiptsUi(messages);
        }
        lastMessagesFingerprint = fingerprint;
        return;
      }
      if (quiet && !pinBottom && !preserveScroll && fingerprint === lastMessagesFingerprint && messageScrollRoomId === roomId) {
        return;
      }

      let anchorId = null;
      let anchorOffset = 0;
      if (preserveScroll && messageList) {
        const listTop = messageList.getBoundingClientRect().top;
        const anchor = [...messageList.querySelectorAll('[data-event-id]')].find((el) => {
          const rect = el.getBoundingClientRect();
          return rect.bottom > listTop + 8;
        });
        if (anchor?.dataset?.eventId) {
          anchorId = anchor.dataset.eventId;
          anchorOffset = anchor.getBoundingClientRect().top - listTop;
        }
      }

      const roomChanged = messageScrollRoomId !== roomId;
      if ((pinBottom || roomChanged || !quiet) && !preserveScroll) {
        stickMessagesToBottom = true;
      }
      messageScrollRoomId = roomId;
      lastMessagesFingerprint = fingerprint;
      lastMessagesContentFingerprint = contentFingerprint;

      messagePaintLock += 1;
      paintedMessages = true;
      messageList.innerHTML = '';
      applyMessageLayoutPrefs();
      const roomMeta = roomCatalog.find((entry) => entry.roomId === roomId);
      if (timelineAtStart) {
        if (roomMeta) appendRoomTimelineIntro(roomMeta);
        else {
          const start = document.createElement('div');
          start.className = 'timeline-history-status timeline-history-status--start';
          start.textContent = 'Beginning of conversation';
          messageList.appendChild(start);
        }
      } else {
        const more = document.createElement('div');
        more.className = 'timeline-history-status';
        more.textContent = 'Scroll up for earlier messages';
        messageList.appendChild(more);
      }
      const roomEncrypted = Boolean(roomMeta?.encrypted);
      let lastDayKey = '';
      let lastMsgSender = null;
      let lastMsgTs = 0;
      const MESSAGE_GROUP_MS = 5 * 60 * 1000;
      // Only the latest message you sent may show read receipts — sending again
      // clears checks on older ones until peers catch up.
      const latestMineEventId = latestMineMessageEventId(messages);
      for (const msg of messages) {
        if (msg.redacted && !showHiddenEventsEnabled()) continue;
        if (msg.systemKind === 'membership' && hideMembershipEnabled()) continue;
        if (msg.systemKind === 'profile' && hideProfileChangeEnabled()) continue;
        if (
          msg.type !== 'm.room.message' &&
          !msg.encrypted &&
          msg.type !== 'm.room.member' &&
          msg.type !== 'm.room.name' &&
          msg.type !== 'm.room.avatar' &&
          msg.type !== 'm.room.topic' &&
          !msg.systemKind
        ) {
          continue;
        }
        const nextDay = dayKeyFromTs(msg.ts);
        if (nextDay && nextDay !== lastDayKey) {
          if (lastDayKey) appendTimelineDaySeparator(msg.ts);
          lastDayKey = nextDay;
          lastMsgSender = null;
          lastMsgTs = 0;
        }
        if (msg.systemKind || msg.type === 'm.room.member' || msg.type === 'm.room.name' || msg.type === 'm.room.avatar' || msg.type === 'm.room.topic') {
          appendSystemMessage(msg);
          lastMsgSender = null;
          lastMsgTs = 0;
          continue;
        }
        const hasGallery = Array.isArray(msg.gallery) && msg.gallery.length > 0;
        const hasImage = !hasGallery && msg.msgtype === 'm.image' && msg.imageUrl;
        const hasVideo = msg.msgtype === 'm.video' || Boolean(msg.videoUrl);
        const hasText = typeof msg.body === 'string' && msg.body.trim().length > 0;
        if (msg.redacted) {
          const el = document.createElement('article');
          el.className = 'message message--redacted';
          if (msg.eventId) el.dataset.eventId = msg.eventId;
          el.innerHTML = `
            <div class="message-avatar-wrap"></div>
            <div class="message-main">
              <div class="meta">
                <span class="sender-nameplate">
                  <span class="sender-nameplate-asset" aria-hidden="true"></span>
                  <button type="button" class="sender"></button>
                </span>
                <span class="message-meta-trailing">
                  <span class="sender-mxid"></span>
                  <span class="message-meta-sep" aria-hidden="true">|</span>
                  <span class="when"></span>
                </span>
              </div>
              <div class="body">Message deleted</div>
            </div>
          `;
          el.querySelector('.sender').textContent = msg.senderName || msg.sender || 'unknown';
          const redactedMxid = el.querySelector('.sender-mxid');
          if (redactedMxid && msg.sender) redactedMxid.textContent = msg.sender;
          el.querySelector('.when').textContent = formatMessageTimestamp(msg.ts);
          messageList.appendChild(el);
          lastMsgSender = null;
          lastMsgTs = 0;
          continue;
        }
        if (!msg.encrypted && !hasGallery && !hasImage && !hasVideo && !hasText) continue;

        const continued =
          Boolean(msg.sender) &&
          msg.sender === lastMsgSender &&
          Number(msg.ts) > 0 &&
          Number(lastMsgTs) > 0 &&
          Number(msg.ts) - Number(lastMsgTs) <= MESSAGE_GROUP_MS;

        const el = document.createElement('article');
        el.className = `message${msg.isMine ? ' message--mine' : ''}${continued ? ' message--continued' : ''}`;
        if (msg.sender) el.dataset.sender = msg.sender;
        if (msg.eventId) el.dataset.eventId = msg.eventId;
        const when = formatMessageTimestamp(msg.ts);
        const whenShort = formatTimeOnly(msg.ts);
        const body = msg.encrypted && !hasText && !hasImage && !hasVideo && !hasGallery
          ? '[Unable to decrypt]'
          : msg.encrypted && !hasText
            ? ''
          : hasGallery || hasVideo || hasImage
            ? ''
            : hasText
              ? msg.body
              : '';
        const displayName = msg.senderName || msg.sender || 'unknown';

        if (continued) {
          el.innerHTML = `
            <div class="message-avatar-wrap">
              <time class="message-continued-when"></time>
            </div>
            <div class="message-main">
              <div class="body"></div>
            </div>
          `;
          el.querySelector('.message-continued-when').textContent = whenShort;
        } else {
          el.innerHTML = `
            <div class="message-avatar-wrap"></div>
            <div class="message-main">
              <div class="meta">
                <span class="sender-nameplate">
                  <span class="sender-nameplate-asset" aria-hidden="true"></span>
                  <button type="button" class="sender"></button>
                </span>
                <span class="message-meta-trailing">
                  <span class="sender-mxid"></span>
                  <span class="message-meta-sep" aria-hidden="true">|</span>
                  <span class="when"></span>
                </span>
              </div>
              <div class="body"></div>
            </div>
          `;
        }

        if (msg.eventId) {
          el.appendChild(buildMessageToolbar(msg));
        }

        const avatarWrap = el.querySelector('.message-avatar-wrap');
        if (!continued) {
          const presence = String(msg.senderPresence || (msg.senderOnline ? 'online' : '') || 'offline');
          if (presence === 'online' || presence === 'unavailable' || presence === 'offline') {
            avatarWrap.classList.add(`message-avatar-wrap--${presence}`);
            const strip = document.createElement('span');
            strip.className = 'message-presence';
            strip.setAttribute('aria-hidden', 'true');
            strip.title =
              presence === 'online' ? 'Online' : presence === 'unavailable' ? 'Busy' : 'Away';
            avatarWrap.appendChild(strip);
          }

          if (msg.hasSenderAvatar !== false && msg.senderAvatarUrl) {
            const img = document.createElement('img');
            img.className = 'message-avatar';
            img.alt = '';
            img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';
            img.src = msg.senderAvatarUrl;
            img.addEventListener('load', () => scrollMessagesToBottom(), { once: true });
            img.addEventListener(
              'error',
              () => {
                img.replaceWith(Object.assign(document.createElement('span'), {
                  className: 'message-avatar-fallback',
                  textContent: initials(displayName),
                }));
              },
              { once: true },
            );
            avatarWrap.appendChild(img);
          } else {
            const fallback = document.createElement('span');
            fallback.className = 'message-avatar-fallback';
            fallback.textContent = initials(displayName);
            avatarWrap.appendChild(fallback);
          }

          avatarWrap.title = `View ${displayName}`;
          avatarWrap.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!msg.sender) return;
            const rect = avatarWrap.getBoundingClientRect();
            void showUserProfile(msg.sender, rect.right + 8, rect.top);
          });
        }

        if (!continued) {
          const senderEl = el.querySelector('.sender');
          senderEl.textContent = displayName;
          senderEl.title = msg.sender ? `Mention ${msg.sender}` : `Mention ${displayName}`;
          const mxidEl = el.querySelector('.sender-mxid');
          if (mxidEl && msg.sender) mxidEl.textContent = msg.sender;
          const senderStyle =
            legacyUsernameColorEnabled()
              ? null
              : msg.senderStyle ||
                (msg.sender ? senderStyleCache.get(msg.sender) : null) ||
                null;
          if (msg.sender && msg.senderStyle && !legacyUsernameColorEnabled()) {
            rememberSenderStyle(msg.sender, msg.senderStyle);
          }
          applyUsernameStyle(senderEl, senderStyle, {
            fallbackColor: msg.isMine ? 'var(--lavender)' : nameColorForUser(msg.sender),
          });
          senderEl.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!msg.sender) return;
            addMention({ userId: msg.sender, displayName });
          });
          el.querySelector('.when').textContent = when;
        }

        const toolbarMore = el.querySelector('[data-message-toolbar="more"]');
        el.addEventListener('contextmenu', (event) => {
          if (event.target.closest('a, button, input, textarea, .message-media-frame, .message-toolbar')) return;
          event.preventDefault();
          showMessageMenu(msg, event.clientX, event.clientY, toolbarMore);
          el.querySelector('.message-toolbar')?.classList.add('is-open');
        });

        // Paarrot: MXID lives on the header row — keep it visible when hovering
        // continued messages in the same group.
        if (continued) {
          const findGroupHeader = (fromEl) => {
            let cur = fromEl.previousElementSibling;
            while (cur && cur.classList.contains('message--continued')) {
              cur = cur.previousElementSibling;
            }
            return cur?.classList?.contains('message') ? cur : null;
          };
          el.addEventListener('mouseenter', () => {
            findGroupHeader(el)?.classList.add('message--group-hover');
          });
          el.addEventListener('mouseleave', (event) => {
            const header = findGroupHeader(el);
            if (!header) return;
            const related = event.relatedTarget?.closest?.('.message');
            if (related && (related === header || findGroupHeader(related) === header)) return;
            header.classList.remove('message--group-hover');
          });
        }

        const bodyEl = el.querySelector('.body');
        if (msg.replyToEventId) {
          const reply = document.createElement('button');
          reply.type = 'button';
          reply.className = 'message-reply';
          const who = document.createElement('strong');
          who.textContent = msg.replyToSenderName || msg.replyToSender || 'Message';
          const preview = document.createElement('span');
          preview.textContent = msg.replyToBody || 'View message';
          reply.appendChild(who);
          reply.appendChild(preview);
          reply.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            void jumpToMessage(msg.replyToEventId, {
              missingMessage: 'Original message is not in the loaded timeline yet.',
            });
          });
          bodyEl.appendChild(reply);
        }
        const mediaCaption = (hasImage || hasVideo || hasGallery) ? mediaCaptionOf(msg) : '';
        if (mediaCaption) {
          const captionEl = document.createElement('div');
          captionEl.className = 'message-media-text';
          let rendered = null;
          try {
            rendered = await window.RelayMarkdown?.renderMessage?.({
              body: mediaCaption,
              html: msg.html || '',
            });
          } catch {
            rendered = null;
          }
          if (rendered) captionEl.appendChild(rendered);
          else captionEl.appendChild(linkifyText(mediaCaption));
          bodyEl.appendChild(captionEl);
        }
        if (hasGallery) {
          bodyEl.appendChild(buildMessageGallery(msg));
        } else if (hasVideo) {
          bodyEl.appendChild(buildMessageVideo(msg));
        } else if (hasImage) {
          bodyEl.appendChild(buildMessageImage(msg));
        } else if (body || msg.html) {
          const displayBody = repairEmoticonBrokenUrls(body || '');
          const klipyLink = parseKlipyShareLink(displayBody || '');
          if (klipyLink) {
            mountKlipyEmbed(bodyEl, klipyLink.shareUrl);
          } else {
            let rendered = null;
            try {
              rendered = await window.RelayMarkdown?.renderMessage?.({
                body: displayBody || '',
                html: msg.html || '',
              });
            } catch {
              rendered = null;
            }
            if (rendered) {
              bodyEl.appendChild(rendered);
            } else if (displayBody) {
              bodyEl.appendChild(linkifyText(displayBody));
            }
            if (isJumboEmojiMessage(displayBody || '')) {
              bodyEl.classList.add('body--jumbo-emoji');
              el.classList.add('message--jumbo-emoji');
              enableJumboEmojiConfetti(bodyEl, displayBody || '', {
                eventId: msg.eventId || null,
              });
            }
            const fromBody = extractUrlsFromText(displayBody || '');
            const fromMsg = Array.isArray(msg.urls)
              ? msg.urls
                  .map((url) => repairEmoticonBrokenUrls(String(url || '')))
                  .filter((url) => /^https?:\/\//i.test(url))
              : [];
            const previewUrls = fromBody.length ? fromBody : fromMsg;
            const allowPreview =
              previewUrls.length > 0 &&
              urlPreviewEnabled() &&
              (!roomEncrypted || urlPreviewEncryptedEnabled()) &&
              (!msg.encrypted || urlPreviewEncryptedEnabled());
            if (allowPreview) {
              const previews = document.createElement('div');
              previews.className = 'link-previews';
              bodyEl.appendChild(previews);
              void mountLinkPreviews(previews, previewUrls.slice(0, 2));
            }
          }
        }

        if (msg.eventId && activeRoomId) {
          const reactions = buildReactionRow(msg.reactions, {
            roomId: activeRoomId,
            eventId: msg.eventId,
          });
          if (reactions) {
            const main = el.querySelector('.message-main') || bodyEl.parentElement || el;
            main.appendChild(reactions);
          }
        }

        if (
          msg.isMine &&
          msg.eventId &&
          msg.eventId === latestMineEventId &&
          Array.isArray(msg.readBy) &&
          msg.readBy.length > 0
        ) {
          const receipts = buildMessageReceiptsButton(msg);
          if (receipts) el.querySelector('.message-main')?.appendChild(receipts);
        }

        messageList.appendChild(el);
        lastMsgSender = msg.sender || null;
        lastMsgTs = Number(msg.ts) || 0;
      }

      void warmSenderStyles(messages, roomId, token);
      if (!quiet || pinBottom || stickMessagesToBottom) {
        void markActiveRoomRead(roomId);
      }

      if (preserveScroll && anchorId) {
        scrollingMessagesProgrammatically = true;
        const el = messageList.querySelector(`[data-event-id="${CSS.escape(anchorId)}"]`);
        if (el) {
          const listTop = messageList.getBoundingClientRect().top;
          const delta = el.getBoundingClientRect().top - listTop - anchorOffset;
          messageList.scrollTop += delta;
        }
        requestAnimationFrame(() => {
          scrollingMessagesProgrammatically = false;
          stickMessagesToBottom = isMessageListNearBottom();
          updateJumpToLatestBtn();
        });
      } else if (pinBottom || !quiet || stickMessagesToBottom) {
        pinMessagesToBottom();
      } else {
        updateJumpToLatestBtn();
      }
    } catch (error) {
      if (!quiet) console.error(error);
    } finally {
      if (history && historyLoadingRoomId === roomId) {
        historyLoadingRoomId = null;
      }
      if (paintedMessages) {
        messagePaintLock = Math.max(0, messagePaintLock - 1);
        if (messagePaintLock === 0 && stickMessagesToBottom) {
          scrollMessagesToBottom({ force: true });
        }
      }
    }
  }

  async function loadOlderMessages() {
    if (!activeRoomId || loadingOlderMessages || timelineAtStart) return;
    loadingOlderMessages = true;
    const roomId = activeRoomId;
    const status = messageList?.querySelector('.timeline-history-status:not(.timeline-history-status--start)');
    if (status) status.textContent = 'Loading earlier messages…';
    try {
      // Pull several pages while the user stays near the top so history isn't capped at a few days.
      let rounds = 0;
      let lastAdded = 0;
      while (rounds < 8 && activeRoomId === roomId && !timelineAtStart) {
        const displayLimit = Math.min(
          2500,
          Math.max(400, (activeRoomMessages.length || 0) + 200),
        );
        const data = await api(`/api/rooms/${encodeURIComponent(roomId)}/messages/older`, {
          method: 'POST',
          body: JSON.stringify({ limit: 120, displayLimit: displayLimit }),
        });
        if (activeRoomId !== roomId) return;
        timelineAtStart = Boolean(data.atStart);
        lastAdded = Number(data.added) || 0;
        if (!lastAdded) {
          timelineAtStart = true;
          break;
        }
        await refreshMessages(roomId, {
          quiet: true,
          preserveScroll: true,
          messages: data.messages || [],
          atStart: data.atStart,
          limit: displayLimit,
        });
        rounds += 1;
        // Stop chaining once the user has scrolled away from the top.
        if ((messageList?.scrollTop || 0) > 160) break;
      }
      if (timelineAtStart && status) {
        status.classList.add('timeline-history-status--start');
        status.textContent = 'Beginning of conversation';
      } else if (status && lastAdded) {
        status.textContent = 'Scroll up for earlier messages';
      }
    } catch (error) {
      console.error(error);
      if (status) status.textContent = 'Could not load earlier messages';
    } finally {
      loadingOlderMessages = false;
    }
  }

  composerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!activeRoomId || attachmentsUploading) return;
    const body = composerInput.value.trim();
    const mentions = pendingMentions.map((entry) => ({ ...entry }));
    const hasAttachments = pendingAttachments.length > 0;
    if (!body && mentions.length === 0 && !hasAttachments) return;

    composerInput.value = '';
    clearMentions();
    clearComposerDraft(activeRoomId);
    hideComposerAutocomplete();
    autosizeComposer();
    closeComposerPanels();
    composerInput.focus();
    if (typingIdleTimer) {
      clearTimeout(typingIdleTimer);
      typingIdleTimer = null;
    }
    void sendTypingState(false);

    const gifCommand = /^\/gif(?:\s+(.+))?$/i.exec(body);
    if (gifCommand) {
      const query = String(gifCommand[1] || '').trim();
      openPicker('gif');
      if (query) {
        composerPickerSearch.value = query;
        void loadGifs(query);
      }
      return;
    }

    try {
      if (hasAttachments) {
        let sendBody = body || mentions.length > 0 ? convertTextEmoticons(body) : '';
        let formatted_body = null;
        try {
          if (
            sendBody &&
            markdownFormattingEnabled() &&
            window.RelayMarkdown?.looksLikeMarkdown?.(sendBody)
          ) {
            formatted_body = await window.RelayMarkdown.markdownToHtml(sendBody);
          }
        } catch {
          formatted_body = null;
        }
        // Caption the first attachment instead of sending a separate text event.
        await sendPendingAttachments({
          caption: sendBody || null,
          formatted_body,
          mentions: mentions.length ? mentions : null,
        });
      } else if (pendingEdit?.eventId && (body || mentions.length > 0)) {
        let sendBody = convertTextEmoticons(body);
        let formatted_body = null;
        try {
          if (
            markdownFormattingEnabled() &&
            sendBody &&
            window.RelayMarkdown?.looksLikeMarkdown?.(sendBody)
          ) {
            formatted_body = await window.RelayMarkdown.markdownToHtml(sendBody);
          }
        } catch {
          formatted_body = null;
        }
        await api(
          `/api/rooms/${encodeURIComponent(activeRoomId)}/messages/${encodeURIComponent(pendingEdit.eventId)}/edit`,
          {
            method: 'POST',
            body: JSON.stringify({ body: sendBody, formatted_body }),
          },
        );
      } else if (body || mentions.length > 0) {
        let sendBody = convertTextEmoticons(body);
        let formatted_body = null;
        try {
          if (
            markdownFormattingEnabled() &&
            sendBody &&
            window.RelayMarkdown?.looksLikeMarkdown?.(sendBody)
          ) {
            formatted_body = await window.RelayMarkdown.markdownToHtml(sendBody);
          }
        } catch {
          formatted_body = null;
        }
        await api(`/api/rooms/${encodeURIComponent(activeRoomId)}/send`, {
          method: 'POST',
          body: JSON.stringify({
            body: sendBody,
            mentions,
            formatted_body,
            replyToEventId: pendingReply?.eventId || null,
            threadRootId: pendingReply?.thread ? pendingReply.eventId : null,
          }),
        });
      }
      clearPendingReply();
      clearPendingEdit();
      // Don't block the composer on a full timeline rebuild.
      void refreshMessages(activeRoomId, { pinBottom: true });
      composerInput.focus();
    } catch (error) {
      if (body || mentions.length > 0) {
        composerInput.value = body;
        pendingMentions = mentions;
        renderMentionChips();
        autosizeComposer();
      }
      alert(error.message || String(error));
      composerInput.focus();
    }
  });

  function renderMentionChips() {
    composerMentions.innerHTML = '';
    composerMentions.hidden = pendingMentions.length === 0;
    for (const mention of pendingMentions) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'composer-mention-chip';
      chip.title = `Remove ${mention.userId}`;
      chip.innerHTML = `<span></span>`;
      chip.querySelector('span').textContent = `@${mention.displayName}`;
      chip.addEventListener('click', () => {
        pendingMentions = pendingMentions.filter((entry) => entry.userId !== mention.userId);
        renderMentionChips();
        composerInput.focus();
      });
      composerMentions.appendChild(chip);
    }
  }

  function clearMentions() {
    pendingMentions = [];
    renderMentionChips();
  }

  function addMention({ userId, displayName }) {
    if (!userId) return;
    if (!composerForm.hidden) {
      // keep composer open
    } else if (activeRoomId) {
      composerForm.hidden = false;
    } else {
      return;
    }

    const name = String(displayName || userId.slice(1).split(':')[0] || userId).trim();
    if (!pendingMentions.some((entry) => entry.userId === userId)) {
      pendingMentions.push({ userId, displayName: name });
      renderMentionChips();
    }
    composerInput.focus();
  }

  const EMOJI_SHORTCODES = {
    '😀': 'grinning', '😃': 'smiley', '😄': 'smile', '😁': 'grin', '😆': 'laughing', '😅': 'sweat_smile',
    '🤣': 'rofl', '😂': 'joy', '🙂': 'slightly_smiling_face', '😊': 'blush', '😇': 'innocent',
    '🥰': 'smiling_face_with_three_hearts', '😍': 'heart_eyes', '🤩': 'star_struck', '😘': 'kissing_heart',
    '😗': 'kissing', '😚': 'kissing_closed_eyes', '😙': 'kissing_smiling_eyes', '🥲': 'smiling_face_with_tear',
    '😋': 'yum', '😛': 'stuck_out_tongue', '😜': 'stuck_out_tongue_winking_eye', '🤪': 'zany_face',
    '😝': 'stuck_out_tongue_closed_eyes', '🤑': 'money_mouth_face', '🤗': 'hugs', '🤭': 'face_with_hand_over_mouth',
    '🤫': 'shushing_face', '🤔': 'thinking', '🤐': 'zipper_mouth_face', '🤨': 'face_with_raised_eyebrow',
    '😐': 'neutral_face', '😑': 'expressionless', '😶': 'no_mouth', '😏': 'smirk', '😒': 'unamused',
    '🙄': 'roll_eyes', '😬': 'grimacing', '😮‍💨': 'face_exhaling', '🤥': 'lying_face', '😌': 'relieved',
    '😔': 'pensive', '😪': 'sleepy', '🤤': 'drooling_face', '😴': 'sleeping', '😷': 'mask',
    '🤒': 'face_with_thermometer', '🤕': 'face_with_head_bandage', '🤢': 'nauseated_face', '🤮': 'vomiting_face',
    '🥵': 'hot_face', '🥶': 'cold_face', '🥴': 'woozy_face', '😵': 'dizzy_face', '🤯': 'exploding_head',
    '🤠': 'cowboy_hat_face', '🥳': 'partying_face', '🥸': 'disguised_face', '😎': 'sunglasses',
    '🤓': 'nerd_face', '🧐': 'monocle_face', '😕': 'confused', '😟': 'worried', '🙁': 'slightly_frowning_face',
    '☹️': 'frowning_face', '😮': 'open_mouth', '😯': 'hushed', '😲': 'astonished', '😳': 'flushed',
    '🥺': 'pleading_face', '😦': 'frowning', '😧': 'anguished', '😨': 'fearful', '😰': 'cold_sweat',
    '😥': 'disappointed_relieved', '😢': 'cry', '😭': 'sob', '😱': 'scream', '😖': 'confounded',
    '😣': 'persevere', '😞': 'disappointed', '😓': 'sweat', '😩': 'weary', '😫': 'tired_face',
    '🥱': 'yawning_face', '😤': 'triumph', '😡': 'rage', '😠': 'angry', '🤬': 'face_with_symbols_on_mouth',
    '😈': 'smiling_imp', '👿': 'imp', '💀': 'skull', '☠️': 'skull_and_crossbones', '💩': 'poop',
    '🤡': 'clown_face', '👹': 'japanese_ogre', '👺': 'japanese_goblin', '👻': 'ghost', '👽': 'alien',
    '👾': 'space_invader', '🤖': 'robot', '👋': 'wave', '🤚': 'raised_back_of_hand', '🖐️': 'hand_splayed',
    '✋': 'hand', '🖖': 'vulcan_salute', '👌': 'ok_hand', '🤌': 'pinched_fingers', '🤏': 'pinching_hand',
    '✌️': 'v', '🤞': 'crossed_fingers', '🤟': 'love_you_gesture', '🤘': 'metal', '🤙': 'call_me_hand',
    '👈': 'point_left', '👉': 'point_right', '👆': 'point_up_2', '🖕': 'middle_finger', '👇': 'point_down',
    '☝️': 'point_up', '👍': 'thumbsup', '👎': 'thumbsdown', '✊': 'fist', '👊': 'facepunch',
    '🤛': 'left_facing_fist', '🤜': 'right_facing_fist', '👏': 'clap', '🙌': 'raised_hands',
    '❤️': 'heart', '🧡': 'orange_heart', '💛': 'yellow_heart', '💚': 'green_heart', '💙': 'blue_heart',
    '💜': 'purple_heart', '🖤': 'black_heart', '🤍': 'white_heart', '🤎': 'brown_heart', '💔': 'broken_heart',
    '🔥': 'fire', '✨': 'sparkles', '🎉': 'tada', '🙏': 'pray', '💯': '100', '👀': 'eyes', '💪': 'muscle',
    '🐶': 'dog', '🐱': 'cat', '🐭': 'mouse', '🐹': 'hamster', '🐰': 'rabbit', '🦊': 'fox_face', '🐻': 'bear',
    '🐼': 'panda_face', '🐨': 'koala', '🐯': 'tiger', '🦁': 'lion', '🐮': 'cow', '🐷': 'pig', '🐸': 'frog',
    '🐵': 'monkey_face', '🦄': 'unicorn', '🐝': 'bee', '🐛': 'bug', '🦋': 'butterfly', '🌸': 'cherry_blossom',
    '🌲': 'evergreen_tree', '🍀': 'four_leaf_clover', '🌊': 'ocean', '⭐': 'star', '🌟': 'star2',
    '🍎': 'apple', '🍌': 'banana', '🍉': 'watermelon', '🍇': 'grapes', '🍓': 'strawberry', '🍑': 'peach',
    '🍕': 'pizza', '🍔': 'hamburger', '🍟': 'fries', '🍣': 'sushi', '🍪': 'cookie', '🍩': 'doughnut',
    '🎂': 'birthday', '☕': 'coffee', '🍵': 'tea', '🍺': 'beer', '🍻': 'beers', '⚽': 'soccer',
    '🏀': 'basketball', '🎾': 'tennis', '🏆': 'trophy', '🎮': 'video_game', '🎲': 'game_die', '🎨': 'art',
    '🎬': 'clapper', '🎤': 'microphone', '🎧': 'headphones', '🎸': 'guitar', '🚀': 'rocket', '✈️': 'airplane',
    '🚗': 'car', '🏠': 'house', '🌈': 'rainbow', '⚡': 'zap', '💥': 'boom', '☀️': 'sunny', '🌙': 'moon',
    '📱': 'iphone', '💻': 'computer', '📷': 'camera', '💡': 'bulb', '🔒': 'lock', '🔑': 'key',
    '📦': 'package', '✉️': 'email', '📝': 'memo', '📌': 'pushpin', '📎': 'paperclip', '✂️': 'scissors',
    '🏳️': 'white_flag', '🏴': 'black_flag', '🏁': 'checkered_flag', '🚩': 'triangular_flag_on_post',
    '🇺🇸': 'us', '🇬🇧': 'gb', '🇨🇦': 'canada', '🇦🇺': 'australia', '🇯🇵': 'jp', '🇩🇪': 'de', '🇫🇷': 'fr',
    '🇮🇹': 'it', '🇪🇸': 'es', '🇧🇷': 'brazil', '🇲🇽': 'mexico', '🇮🇳': 'india', '🇨🇳': 'cn', '🇰🇷': 'kr',
    '🫡': 'saluting_face', '🫠': 'melting_face', '🫶': 'heart_hands', '🤝': 'handshake',
  };

  const EMOJI_GROUP_ICONS = {
    recent: '<path d="M20.8 8.6a5.5 5.5 0 0 0-7.8 0L12 9.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    smileys: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.8 2.2 3.5 2.2 3.5-2.2 3.5-2.2"/><circle cx="9" cy="10" r="1" class="ui-icon--fill"/><circle cx="15" cy="10" r="1" class="ui-icon--fill"/>',
    nature: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    food: '<path d="M18 8h1a4 4 0 0 0 0-8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
    activities: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    travel: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 15-5-5-4 4-2-2-5 5"/>',
    objects: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
    symbols: '<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M5 16l.7 2L8 19l-2.3.7L5 22l-.7-2.3L2 19l2.3-.7L5 16z"/>',
    flags: '<path d="M4 22V4"/><path d="M4 4c3 2 5-1 8 1s5-1 8 1v8c-3-2-5 1-8-1s-5 1-8-1z"/>',
  };

  const EMOJI_GROUPS_BASE = [
    {
      id: 'smileys',
      label: 'Smileys & People',
      emojis: [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗',
        '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐',
        '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
        '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁',
        '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
        '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹',
        '👺', '👻', '👽', '👾', '🤖', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟',
        '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌',
      ],
    },
    {
      id: 'nature',
      label: 'Animals & Nature',
      emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🪲', '🌸', '🌼', '🌻', '🌲', '🌳', '🌴', '🌵', '🍀', '🍁', '🌊', '🔥', '⭐', '🌟'],
    },
    {
      id: 'food',
      label: 'Food & Drinks',
      emojis: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🍣', '🍪', '🍩', '🎂', '🍰', '☕', '🍵', '🍺', '🍻', '🥂', '🍷'],
    },
    {
      id: 'activities',
      label: 'Activity',
      emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🥅', '⛳', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛶', '🏆', '🥇', '🥈', '🥉', '🎖️', '🏅', '🎫', '🎪', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🕹️'],
    },
    {
      id: 'travel',
      label: 'Travel & Places',
      emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '✈️', '🛫', '🛬', '🚀', '🛸', '🚁', '⛵', '🚢', '🏠', '🏡', '🏢', '🏣', '🏥', '🏦', '🏨', '🏪', '🏫', '🏰', '🗼', '🗽', '⛩️', '🕌', '⛪', '🌅', '🌄', '🌃', '🌌', '🌉', '🌁', '🌈', '☀️', '🌙', '⭐'],
    },
    {
      id: 'objects',
      label: 'Objects',
      emojis: ['⌚', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '📷', '📸', '📹', '🎥', '📞', '☎️', '📺', '📻', '🧭', '⏰', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '💸', '💵', '💳', '💎', '🔧', '🔨', '🔩', '⚙️', '🔫', '💣', '🔮', '💊', '💉', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🧸', '🖼️', '🛒', '🎁', '🎈', '🎉', '✉️', '📧', '📦', '📋', '📁', '📂', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🔗', '📎', '📐', '📏', '📌', '📍', '✂️', '🖊️', '🖋️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓'],
    },
    {
      id: 'symbols',
      label: 'Symbols',
      emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭'],
    },
    {
      id: 'flags',
      label: 'Flags',
      emojis: ['🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🇺🇳', '🇺🇸', '🇬🇧', '🇨🇦', '🇦🇺', '🇳🇿', '🇯🇵', '🇰🇷', '🇨🇳', '🇮🇳', '🇩🇪', '🇫🇷', '🇮🇹', '🇪🇸', '🇵🇹', '🇧🇷', '🇲🇽', '🇦🇷', '🇨🇱', '🇨🇴', '🇵🇪', '🇻🇪', '🇿🇦', '🇳🇬', '🇪🇬', '🇰🇪', '🇹🇷', '🇸🇦', '🇦🇪', '🇮🇱', '🇷🇺', '🇺🇦', '🇵🇱', '🇳🇱', '🇧🇪', '🇸🇪', '🇳🇴', '🇩🇰', '🇫🇮', '🇮🇪', '🇨🇭', '🇦🇹', '🇬🇷', '🇹🇭', '🇻🇳', '🇵🇭', '🇮🇩', '🇲🇾', '🇸🇬', '🇹🇼', '🇭🇰'],
    },
  ];

  const DEFAULT_MOST_USED = ['👍', '😂', '❤️', '🔥', '✨', '🎉', '🙏', '💯', '👀', '😅', '🤣', '😊', '😎', '🤔', '👋', '💪'];

  function emojiShortcode(emoji) {
    if (EMOJI_SHORTCODES[emoji]) return EMOJI_SHORTCODES[emoji];
    try {
      const cps = [...emoji].map((ch) => ch.codePointAt(0).toString(16)).join('-');
      return cps || 'emoji';
    } catch {
      return 'emoji';
    }
  }

  function getRecentEmojis() {
    const stored = readJsonArray('relay.recentEmojis');
    const fromReactions = getRecentReactions();
    return [...new Set([...stored, ...fromReactions, ...DEFAULT_MOST_USED])].slice(0, 32);
  }

  function rememberRecentEmoji(emoji) {
    const key = String(emoji || '').trim();
    if (!key) return;
    const next = [key, ...getRecentEmojis().filter((entry) => entry !== key)].slice(0, 32);
    try {
      localStorage.setItem('relay.recentEmojis', JSON.stringify(next));
    } catch {
      // ignore
    }
    rememberRecentReaction(key);
  }

  function getEmojiGroups() {
    return [
      { id: 'recent', label: 'Most Used', emojis: getRecentEmojis() },
      ...EMOJI_GROUPS_BASE,
    ];
  }

  const STICKERS = [
    '🎉', '🔥', '💀', '😭', '😂', '😎', '🤓', '👻', '🤖', '🐸', '🐱', '🐶', '🦄', '🍕', '☕', '🎮',
    '🚀', '🌈', '⚡', '💥', '✨', '🙌', '👍', '👎', '❤️', '🖤', '💯', '🤝', '🫡', '🫠', '👀', '🫶',
  ];

  let pickerMode = null; // 'emoji' | 'sticker' | 'gif'
  let gifCache = [];
  let gifSearchTimer = null;
  let pickerActiveGroupId = 'recent';

  function setPickerPreview(emoji, shortcode = null) {
    if (!composerPickerPreview) return;
    if (!emoji) {
      composerPickerPreview.hidden = true;
      if (composerPickerPreviewEmoji) composerPickerPreviewEmoji.textContent = '';
      if (composerPickerPreviewCode) composerPickerPreviewCode.textContent = '';
      return;
    }
    composerPickerPreview.hidden = false;
    if (composerPickerPreviewEmoji) composerPickerPreviewEmoji.textContent = emoji;
    if (composerPickerPreviewCode) {
      composerPickerPreviewCode.textContent = `:${shortcode || emojiShortcode(emoji)}:`;
    }
  }

  function setPickerSidebarVisible(visible) {
    if (!composerPickerSidebar) return;
    composerPickerSidebar.hidden = !visible;
    composerPicker?.classList.toggle('has-sidebar', Boolean(visible));
  }

  function renderEmojiSidebar(groups) {
    if (!composerPickerSidebar) return;
    composerPickerSidebar.replaceChildren();
    for (const group of groups) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `composer-picker-cat${group.id === pickerActiveGroupId ? ' is-active' : ''}`;
      btn.dataset.emojiGroup = group.id;
      btn.title = group.label;
      btn.setAttribute('aria-label', group.label);
      btn.innerHTML = `<svg class="ui-icon ui-icon--stroke" viewBox="0 0 24 24" aria-hidden="true">${EMOJI_GROUP_ICONS[group.id] || EMOJI_GROUP_ICONS.symbols}</svg>`;
      btn.addEventListener('click', () => {
        pickerActiveGroupId = group.id;
        for (const el of composerPickerSidebar.querySelectorAll('.composer-picker-cat')) {
          el.classList.toggle('is-active', el.dataset.emojiGroup === group.id);
        }
        const target = composerPickerBody.querySelector(`[data-emoji-group="${group.id}"]`);
        target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
      composerPickerSidebar.appendChild(btn);
    }
  }

  function selectEmoji(emoji) {
    rememberRecentEmoji(emoji);
    if (pendingReactionTarget) {
      const target = pendingReactionTarget;
      pendingReactionTarget = null;
      closeComposerPanels();
      void toggleMessageReaction(target.roomId, target.eventId, emoji).catch((error) => {
        window.alert((error.message || String(error)).replace(/^MatrixError:\s*/i, ''));
      });
      return;
    }
    insertAtCursor(emoji);
  }

  function autosizeComposer() {
    if (!composerInput) return;
    const min = 40;
    const max = 160;
    const previous = composerInput.offsetHeight;
    // Measure without collapsing to 'auto' (avoids 1px layout thrash).
    composerInput.style.height = `${min}px`;
    const next = Math.min(max, Math.max(min, composerInput.scrollHeight));
    composerInput.style.height = `${next}px`;
    // Composer growth resizes the message list — don't pin-scroll for tiny height tweaks.
    if (Math.abs(next - previous) <= 2) return;
  }

  function setToolPressed(btn, pressed) {
    btn.classList.toggle('is-active', pressed);
    btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  }

  function closeComposerPanels() {
    composerMarkdownBar.hidden = true;
    composerPicker.hidden = true;
    setToolPressed(composerMarkdownBtn, false);
    setToolPressed(composerEmojiBtn, false);
    setToolPressed(composerGifBtn, false);
    pickerMode = null;
    pendingReactionTarget = null;
    setPickerSidebarVisible(false);
    setPickerPreview(null);
  }

  function wrapSelection(before, after = before, placeholder = 'text') {
    const start = composerInput.selectionStart || 0;
    const end = composerInput.selectionEnd || 0;
    const value = composerInput.value;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    composerInput.value = next;
    const selectFrom = start + before.length;
    const selectTo = selectFrom + selected.length;
    composerInput.focus();
    composerInput.setSelectionRange(selectFrom, selectTo);
    autosizeComposer();
  }

  function insertAtCursor(text) {
    const start = composerInput.selectionStart || 0;
    const end = composerInput.selectionEnd || 0;
    const value = composerInput.value;
    composerInput.value = value.slice(0, start) + text + value.slice(end);
    const caret = start + text.length;
    composerInput.focus();
    composerInput.setSelectionRange(caret, caret);
    autosizeComposer();
  }

  function applyMarkdown(action) {
    switch (action) {
      case 'bold':
        wrapSelection('**', '**', 'bold');
        break;
      case 'italic':
        wrapSelection('*', '*', 'italic');
        break;
      case 'underline':
        wrapSelection('<u>', '</u>', 'underline');
        break;
      case 'strike':
        wrapSelection('~~', '~~', 'strike');
        break;
      case 'code':
        wrapSelection('`', '`', 'code');
        break;
      case 'spoiler':
        wrapSelection('||', '||', 'spoiler');
        break;
      case 'quote':
        wrapSelection('> ', '', 'quote');
        break;
      case 'codeblock':
        wrapSelection('```\n', '\n```', 'code');
        break;
      case 'ul':
        wrapSelection('- ', '', 'item');
        break;
      case 'ol':
        wrapSelection('1. ', '', 'item');
        break;
      case 'heading':
        wrapSelection('# ', '', 'heading');
        break;
      default:
        break;
    }
  }

  function renderEmojiPicker(query = '') {
    const q = query.trim().toLowerCase();
    composerPickerBody.innerHTML = '';
    setPickerSidebarVisible(true);
    let shown = 0;
    const groups = getEmojiGroups();
    const visibleGroups = [];

    for (const group of groups) {
      const emojis = group.emojis.filter((emoji) => {
        if (!q) return true;
        const code = emojiShortcode(emoji);
        return (
          emoji.includes(q) ||
          group.label.toLowerCase().includes(q) ||
          code.includes(q) ||
          `:${code}:`.includes(q)
        );
      });
      if (emojis.length === 0) continue;
      visibleGroups.push(group);

      const section = document.createElement('section');
      section.className = 'composer-emoji-group';
      section.dataset.emojiGroup = group.id;

      const title = document.createElement('div');
      title.className = 'composer-picker-section-title';
      title.textContent = group.label;
      section.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'composer-emoji-grid';
      for (const emoji of emojis) {
        const code = emojiShortcode(emoji);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'composer-emoji-btn';
        btn.textContent = emoji;
        btn.title = `:${code}:`;
        btn.dataset.emoji = emoji;
        btn.dataset.shortcode = code;
        btn.addEventListener('mouseenter', () => setPickerPreview(emoji, code));
        btn.addEventListener('focus', () => setPickerPreview(emoji, code));
        btn.addEventListener('click', () => selectEmoji(emoji));
        grid.appendChild(btn);
        shown += 1;
      }
      section.appendChild(grid);
      composerPickerBody.appendChild(section);
    }

    renderEmojiSidebar(visibleGroups.length ? visibleGroups : groups);
    if (shown === 0) {
      composerPickerBody.innerHTML = '<div class="composer-picker-empty">No emoji match</div>';
      setPickerPreview(null);
    } else if (!composerPickerPreview || composerPickerPreview.hidden) {
      const first = composerPickerBody.querySelector('.composer-emoji-btn');
      if (first) setPickerPreview(first.dataset.emoji, first.dataset.shortcode);
    }
  }

  function renderStickerPicker(query = '') {
    const stickers = getComposerStickerEntries(query);
    composerPickerBody.innerHTML = '';
    setPickerSidebarVisible(false);
    setPickerPreview(null);
    const title = document.createElement('div');
    title.className = 'composer-picker-section-title';
    title.textContent = 'Stickers';
    composerPickerBody.appendChild(title);

    if (stickers.length === 0) {
      composerPickerBody.innerHTML +=
        '<div class="composer-picker-empty">No sticker packs yet — add some in Settings → Emojis & Stickers</div>';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'composer-sticker-grid';
    for (const sticker of stickers) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'composer-sticker-btn';
      if (sticker.kind === 'image') {
        const img = document.createElement('img');
        img.src = sticker.value;
        img.alt = sticker.label;
        btn.append(img);
      } else {
        btn.textContent = sticker.value;
      }
      btn.addEventListener('click', async () => {
        if (!activeRoomId) return;
        try {
          if (sticker.kind === 'image') {
            await api(`/api/rooms/${encodeURIComponent(activeRoomId)}/send-image`, {
              method: 'POST',
              body: JSON.stringify({
                url: `${window.location.origin}${sticker.value}`,
                filename: sticker.fileName || 'sticker.webp',
              }),
            });
          }
          closeComposerPanels();
          await refreshMessages(activeRoomId);
        } catch (error) {
          alert(error.message || String(error));
        }
      });
      grid.appendChild(btn);
    }
    composerPickerBody.appendChild(grid);
  }

  async function loadGifs(query = '') {
    const q = String(query || '').trim();
    setPickerSidebarVisible(false);
    setPickerPreview(null);
    composerPickerBody.innerHTML = `<div class="composer-picker-status">${
      q ? 'Searching Klipy…' : 'Loading trending GIFs…'
    }</div>`;
    try {
      const data = await api(`/api/gifs?q=${encodeURIComponent(q)}&limit=24`);
      gifCache = data.gifs || [];
      renderGifPicker(q);
    } catch (error) {
      composerPickerBody.innerHTML = `<div class="composer-picker-empty">${error.message || 'GIF search failed'}</div>`;
    }
  }

  function renderGifPicker(query = '') {
    composerPickerBody.innerHTML = '';
    if (gifCache.length === 0) {
      composerPickerBody.innerHTML = `<div class="composer-picker-empty">${
        query ? `No GIFs found for “${query}”` : 'No trending GIFs right now'
      }</div>`;
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'composer-gif-grid';
    for (const gif of gifCache) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'composer-gif-btn';
      btn.title = gif.title || 'GIF';
      const img = document.createElement('img');
      img.src = gif.preview || gif.url;
      img.alt = gif.title || 'GIF';
      img.loading = 'lazy';
      btn.appendChild(img);
      btn.addEventListener('click', async () => {
        if (!activeRoomId) return;
        const shareUrl = gif.shareUrl || gif.url;
        if (!shareUrl) return;
        btn.disabled = true;
        try {
          await api(`/api/rooms/${encodeURIComponent(activeRoomId)}/send`, {
            method: 'POST',
            body: JSON.stringify({ body: shareUrl }),
          });
          closeComposerPanels();
          await refreshMessages(activeRoomId);
        } catch (error) {
          alert(error.message || String(error));
        } finally {
          btn.disabled = false;
        }
      });
      grid.appendChild(btn);
    }
    composerPickerBody.appendChild(grid);
  }

  function syncPickerTabs() {
    for (const tab of composerPicker.querySelectorAll('[data-picker-tab]')) {
      const id = tab.dataset.pickerTab;
      if (id === 'gif') {
        tab.hidden = pickerMode !== 'gif';
        tab.classList.toggle('is-active', pickerMode === 'gif');
        continue;
      }
      if (id === 'sticker' && pendingReactionTarget) {
        tab.hidden = true;
        tab.classList.remove('is-active');
        continue;
      }
      tab.hidden = pickerMode === 'gif';
      tab.classList.toggle('is-active', id === pickerMode);
    }
  }

  function openPicker(mode) {
    pickerMode = mode;
    composerMarkdownBar.hidden = true;
    setToolPressed(composerMarkdownBtn, false);
    setToolPressed(composerEmojiBtn, mode === 'emoji' || mode === 'sticker');
    setToolPressed(composerGifBtn, mode === 'gif');
    composerPicker.hidden = false;
    composerPickerSearch.value = '';
    syncPickerTabs();

    if (mode === 'gif') {
      composerPickerSearch.placeholder = 'Search Klipy GIFs…';
      void loadGifs('');
    } else if (mode === 'sticker') {
      composerPickerSearch.placeholder = 'Search stickers';
      renderStickerPicker('');
    } else {
      composerPickerSearch.placeholder = 'Search';
      pickerActiveGroupId = 'recent';
      renderEmojiPicker('');
    }
  }

  function togglePicker(mode) {
    if (!composerPicker.hidden && pickerMode === mode) {
      closeComposerPanels();
      return;
    }
    if (mode === 'emoji' && !composerPicker.hidden && (pickerMode === 'emoji' || pickerMode === 'sticker')) {
      closeComposerPanels();
      return;
    }
    openPicker(mode);
  }

  composerInput.addEventListener('input', () => {
    autosizeComposer();
    bumpLocalTyping();
  });
  composerInput.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace' && !composerInput.value && pendingMentions.length > 0) {
      event.preventDefault();
      pendingMentions.pop();
      renderMentionChips();
      return;
    }
    if (event.key !== 'Enter') return;
    const newlineMode = enterForNewlineEnabled();
    const sendCombo = event.ctrlKey || event.metaKey;
    if (newlineMode) {
      if (sendCombo) {
        event.preventDefault();
        composerForm.requestSubmit();
      }
      return;
    }
    if (!event.shiftKey) {
      event.preventDefault();
      composerForm.requestSubmit();
    }
  });

  composerMarkdownBtn.addEventListener('click', () => {
    const open = composerMarkdownBar.hidden;
    if (open) {
      composerPicker.hidden = true;
      setToolPressed(composerEmojiBtn, false);
      setToolPressed(composerGifBtn, false);
      pickerMode = null;
    }
    composerMarkdownBar.hidden = !open;
    setToolPressed(composerMarkdownBtn, open);
  });

  composerMarkdownBar.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-md]');
    if (!btn) return;
    applyMarkdown(btn.dataset.md);
  });

  composerEmojiBtn.addEventListener('click', () => togglePicker('emoji'));
  composerGifBtn.addEventListener('click', () => togglePicker('gif'));

  composerPicker.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-picker-tab]');
    if (!tab || tab.hidden) return;
    openPicker(tab.dataset.pickerTab);
  });

  composerPickerSearch.addEventListener('input', () => {
    const q = composerPickerSearch.value;
    if (pickerMode === 'gif') {
      clearTimeout(gifSearchTimer);
      gifSearchTimer = setTimeout(() => void loadGifs(q), 250);
    } else if (pickerMode === 'sticker') {
      renderStickerPicker(q);
    } else {
      renderEmojiPicker(q);
    }
  });

  composerAttachBtn.addEventListener('click', () => composerFile.click());
  composerFile.addEventListener('change', () => {
    const files = composerFile.files ? [...composerFile.files] : [];
    composerFile.value = '';
    if (!files.length || !activeRoomId) return;
    stagePendingImages(files);
  });

  ;['dragenter', 'dragover'].forEach((type) => {
    composerForm.addEventListener(type, (event) => {
      if (!activeRoomId) return;
      event.preventDefault();
      setComposerDropActive(true);
    });
  });
  ;['dragleave', 'drop'].forEach((type) => {
    composerForm.addEventListener(type, (event) => {
      event.preventDefault();
      if (type === 'dragleave' && event.target !== composerForm) return;
      setComposerDropActive(false);
    });
  });
  composerForm.addEventListener('drop', (event) => {
    event.preventDefault();
    setComposerDropActive(false);
    const files = [...(event.dataTransfer?.files || [])];
    if (files.length) stagePendingImages(files);
  });

  composerInput.addEventListener('paste', (event) => {
    const items = [...(event.clipboardData?.items || [])];
    const imageItems = items.filter((item) => {
      const file = item.getAsFile?.();
      if (item.type.startsWith('image/') || item.type.startsWith('video/')) return true;
      return Boolean(file && isMediaFile(file));
    });
    if (imageItems.length === 0) return;
    event.preventDefault();
    const files = imageItems
      .map((item) => item.getAsFile())
      .filter(Boolean);
    if (files.length) stagePendingImages(files);
  });

  document.getElementById('imageLightboxScrim')?.addEventListener('click', () => {
    closeImageLightbox();
  });
  imageLightboxDownload?.addEventListener('click', () => {
    if (!lightboxState) return;
    void downloadImage(lightboxState.url, lightboxState.filename);
  });
  imageLightboxClose?.addEventListener('click', () => closeImageLightbox());
  imageLightboxZoomIn?.addEventListener('click', () => {
    setLightboxZoom(lightboxZoom + LIGHTBOX_ZOOM_STEP);
  });
  imageLightboxZoomOut?.addEventListener('click', () => {
    setLightboxZoom(lightboxZoom - LIGHTBOX_ZOOM_STEP);
  });
  // Paarrot chip: toggle 100% ↔ 200%
  imageLightboxZoomLabel?.addEventListener('click', () => {
    setLightboxZoom(lightboxZoom === 1 ? 2 : 1);
  });
  // Pan: drag the image or empty stage; continues if pointer leaves either edge
  imageLightboxImg?.addEventListener('pointerdown', startLightboxPan);
  imageLightboxStage?.addEventListener('pointerdown', (event) => {
    if (event.target === imageLightboxImg) return;
    startLightboxPan(event);
  });
  // Wheel pans the image; block chat scroll underneath
  document.addEventListener('wheel', onLightboxScrollBlock, { capture: true, passive: false });
  document.addEventListener('touchmove', onLightboxScrollBlock, { capture: true, passive: false });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeComposerPanels();
      if (isLightboxOpen()) closeImageLightbox();
    }
    if (!isLightboxOpen()) return;
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      setLightboxZoom(lightboxZoom + LIGHTBOX_ZOOM_STEP);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      setLightboxZoom(lightboxZoom - LIGHTBOX_ZOOM_STEP);
    } else if (event.key === '0') {
      event.preventDefault();
      setLightboxZoom(1);
    }
  });

  async function startCall(video) {
    if (!activeRoomId) return;
    const room = roomCatalog.find((entry) => entry.roomId === activeRoomId);
    voipPeerLabel = room?.name || 'Peer';
    try {
      await ensureLiveKit();
      await window.RelayVoip.placeCall(activeRoomId, { video: Boolean(video) });
      updateCallChrome();
      void refreshRooms();
    } catch (error) {
      alert(error.message || String(error));
      updateCallChrome();
    }
  }

  function setInviteError(message) {
    if (!message) {
      inviteUserError.hidden = true;
      inviteUserError.textContent = '';
      return;
    }
    inviteUserError.hidden = false;
    inviteUserError.textContent = message;
  }

  function setJoinError(message) {
    if (!message) {
      joinRoomError.hidden = true;
      joinRoomError.textContent = '';
      return;
    }
    joinRoomError.hidden = false;
    joinRoomError.textContent = message;
  }

  function openInviteDialog(target) {
    inviteTarget = target;
    inviteUserTitle.textContent = target.kind === 'space' ? 'Invite to space' : 'Invite to room';
    inviteUserMeta.textContent = `Invite someone to ${target.name}.`;
    inviteUserInput.value = '';
    setInviteError('');
    if (typeof inviteUserDialog.showModal === 'function') {
      inviteUserDialog.showModal();
      inviteUserInput.focus();
    }
  }

  function closeInviteDialog() {
    if (inviteUserDialog.open) inviteUserDialog.close();
    inviteTarget = null;
  }

  function openJoinDialog() {
    joinRoomInput.value = '';
    setJoinError('');
    if (typeof joinRoomDialog.showModal === 'function') {
      joinRoomDialog.showModal();
      joinRoomInput.focus();
    }
  }

  function closeJoinDialog() {
    if (joinRoomDialog.open) joinRoomDialog.close();
  }

  function toggleInvitesPanel(force) {
    const next =
      typeof force === 'boolean' ? force : invitesPanel.hidden;
    invitesPanel.hidden = !next;
    invitesBtn.classList.toggle('is-open', next);
    syncDmRailNavActive();
    if (next) void refreshInvites();
  }

  async function refreshInvites() {
    try {
      const data = await api('/api/invites');
      inviteCatalog = data.invites || [];
      const count = inviteCatalog.length;
      const show = count > 0;
      const label = count > 99 ? '99+' : String(count);
      if (invitesBadge) {
        invitesBadge.hidden = !show;
        invitesBadge.textContent = show ? label : '0';
      }
      if (dmInvitesBadge) {
        dmInvitesBadge.hidden = !show;
        dmInvitesBadge.textContent = show ? label : '0';
      }
      renderInvitesList();
    } catch {
      // ignore while logged out / transient
    }
  }

  function renderInvitesList() {
    invitesList.innerHTML = '';
    if (inviteCatalog.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'invite-item';
      empty.style.gridTemplateColumns = '1fr';
      empty.innerHTML = '<span class="settings-muted">No pending invites</span>';
      invitesList.appendChild(empty);
      return;
    }

    for (const invite of inviteCatalog) {
      const li = document.createElement('li');
      li.className = 'invite-item';

      if (invite.hasAvatar !== false && invite.avatarUrl) {
        const img = document.createElement('img');
        img.className = 'invite-avatar';
        img.alt = '';
        img.src = invite.avatarUrl;
        img.addEventListener('error', () => {
          img.replaceWith(Object.assign(document.createElement('span'), {
            className: 'invite-avatar-fallback',
            textContent: initials(invite.name),
          }));
        }, { once: true });
        li.appendChild(img);
      } else {
        const fallback = document.createElement('span');
        fallback.className = 'invite-avatar-fallback';
        fallback.textContent = initials(invite.name);
        li.appendChild(fallback);
      }

      const copy = document.createElement('div');
      copy.className = 'invite-copy';
      const title = document.createElement('strong');
      title.textContent = invite.name;
      const meta = document.createElement('span');
      const kind = invite.isSpace ? 'Space' : 'Room';
      meta.textContent = invite.inviterName
        ? `${kind} · from ${invite.inviterName}`
        : kind;
      copy.appendChild(title);
      copy.appendChild(meta);
      li.appendChild(copy);

      const actions = document.createElement('div');
      actions.className = 'invite-actions';
      const accept = document.createElement('button');
      accept.type = 'button';
      accept.className = 'invite-accept';
      accept.textContent = 'Accept';
      accept.addEventListener('click', () => void acceptInvite(invite));
      const reject = document.createElement('button');
      reject.type = 'button';
      reject.className = 'invite-reject';
      reject.textContent = 'Decline';
      reject.addEventListener('click', () => void rejectInvite(invite));
      actions.appendChild(accept);
      actions.appendChild(reject);
      li.appendChild(actions);

      invitesList.appendChild(li);
    }
  }

  async function acceptInvite(invite) {
    try {
      const result = await api(`/api/invites/${encodeURIComponent(invite.roomId)}/accept`, {
        method: 'POST',
        body: '{}',
      });
      await refreshInvites();
      await refreshSpaces();
      await refreshRooms();
      if (result.isSpace) {
        setSpaceFilter(result.roomId);
      } else {
        activeRoomId = result.roomId;
        persistLastRoom(result.roomId);
        updateTimelineHead(
          roomCatalog.find((entry) => entry.roomId === result.roomId) || {
            roomId: result.roomId,
            name: invite.name,
            avatarUrl: invite.avatarUrl,
            hasAvatar: invite.hasAvatar,
            isDirect: invite.isDirect,
          },
        );
        composerForm.hidden = false;
        updateCallChrome();
        if (invite.isSpace) {
          // already handled
        } else if (activeSpaceFilter !== 'dms' && activeSpaceFilter !== 'home') {
          // stay in current space filter if possible
        }
        void refreshMessages(result.roomId);
        void refreshRooms();
      }
    } catch (error) {
      window.alert((error.message || String(error)).replace(/^MatrixError:\s*/i, ''));
    }
  }

  async function rejectInvite(invite) {
    try {
      await api(`/api/invites/${encodeURIComponent(invite.roomId)}/reject`, {
        method: 'POST',
        body: '{}',
      });
      await refreshInvites();
    } catch (error) {
      window.alert((error.message || String(error)).replace(/^MatrixError:\s*/i, ''));
    }
  }

  voiceCallBtn?.addEventListener('click', () => void startCall(false));
  videoCallBtn?.addEventListener('click', () => void startCall(true));
  roomMembersBtn?.addEventListener('click', () => {
    setMembersPanelOpen(!membersPanelOpen);
  });
  roomMembersClose?.addEventListener('click', () => setMembersPanelOpen(false));

  mobileRoomsBtn?.addEventListener('click', () => {
    if (!isMobileUi()) return;
    setRoomsDrawerOpen(!roomsDrawerOpen);
  });
  mobileNavOverlay?.addEventListener('click', () => {
    if (!isMobileUi()) return;
    setRoomsDrawerOpen(false);
    if (membersPanelOpen) setMembersPanelOpen(false);
    if (sharedMediaOpen) setSharedMediaOpen(false);
  });

  // Edge swipe: open/close left rooms drawer; swipe from right for members.
  (function setupMobileDrawerGestures() {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let mode = null; // 'open-left' | 'close-left' | 'open-right' | 'close-right'

    function onStart(event) {
      if (!isMobileUi() || !chatView || chatView.hidden) return;
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      const w = window.innerWidth || 0;
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = false;
      mode = null;
      if (roomsDrawerOpen) {
        mode = 'close-left';
        tracking = true;
      } else if (membersPanelOpen || sharedMediaOpen) {
        mode = 'close-right';
        tracking = true;
      } else if (startX <= 28) {
        mode = 'open-left';
        tracking = true;
      } else if (activeRoomId && startX >= w - 28) {
        mode = 'open-right';
        tracking = true;
      }
    }

    function onEnd(event) {
      if (!tracking || !mode) return;
      const touch = event.changedTouches?.[0];
      tracking = false;
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 56) {
        mode = null;
        return;
      }
      if (mode === 'open-left' && dx > 56) setRoomsDrawerOpen(true);
      else if (mode === 'close-left' && dx < -56) setRoomsDrawerOpen(false);
      else if (mode === 'open-right' && dx < -56) setMembersPanelOpen(true);
      else if (mode === 'close-right' && dx > 56) {
        setMembersPanelOpen(false);
        setSharedMediaOpen(false);
      }
      mode = null;
    }

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
  })();

  function onMobileDrawerMqChange() {
    if (!isMobileUi()) {
      roomsDrawerOpen = false;
      if (roomMembersPanel) {
        roomMembersPanel.classList.remove('is-mobile-open');
        roomMembersPanel.removeAttribute('inert');
      }
      if (sharedMediaPanel) {
        sharedMediaPanel.classList.remove('is-mobile-open');
        sharedMediaPanel.removeAttribute('inert');
      }
    } else if (!activeRoomId) {
      roomsDrawerOpen = true;
    }
    updateChatStageDrawers();
  }
  if (mobileDrawerMq) {
    if (typeof mobileDrawerMq.addEventListener === 'function') {
      mobileDrawerMq.addEventListener('change', onMobileDrawerMqChange);
    } else if (typeof mobileDrawerMq.addListener === 'function') {
      mobileDrawerMq.addListener(onMobileDrawerMqChange);
    }
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isMobileUi()) return;
    if (roomsDrawerOpen) {
      setRoomsDrawerOpen(false);
      event.preventDefault();
      return;
    }
    if (membersPanelOpen) {
      setMembersPanelOpen(false);
      event.preventDefault();
      return;
    }
    if (sharedMediaOpen) {
      setSharedMediaOpen(false);
      event.preventDefault();
    }
  });
  roomMembersFilter?.addEventListener('input', () => {
    renderRoomMembers(roomMembersFilter.value);
  });
  roomSearchBtn?.addEventListener('click', () => {
    if (messageSearchOpen) closeMessageSearch();
    else openMessageSearch();
  });
  messageSearchBack?.addEventListener('click', () => closeMessageSearch());
  messageSearchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    void runMessageSearch();
  });
  messageSearchFilterDms?.addEventListener('click', () => {
    messageSearchScope = 'dms';
    syncMessageSearchFilters();
    if (String(messageSearchInput?.value || '').trim()) void runMessageSearch();
  });
  messageSearchFilterGlobal?.addEventListener('click', () => {
    messageSearchScope = 'global';
    syncMessageSearchFilters();
    if (String(messageSearchInput?.value || '').trim()) void runMessageSearch();
  });
  messageSearchRoomChip?.addEventListener('click', () => {
    messageSearchScope = 'global';
    syncMessageSearchFilters();
    if (String(messageSearchInput?.value || '').trim()) void runMessageSearch();
  });
  roomPinsBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!roomPinsPanel?.hidden) {
      hideRoomPinsPanel();
      return;
    }
    void openRoomPinsPanel();
  });
  roomPinsClose?.addEventListener('click', () => hideRoomPinsPanel());
  roomThreadsBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!roomThreadsPanel?.hidden) {
      hideRoomThreadsPanel();
      return;
    }
    openRoomThreadsPanel();
  });
  roomThreadsClose?.addEventListener('click', () => hideRoomThreadsPanel());
  roomMediaBtn?.addEventListener('click', () => {
    hideRoomHeaderPopovers();
    setSharedMediaOpen(!sharedMediaOpen);
  });
  sharedMediaClose?.addEventListener('click', () => setSharedMediaOpen(false));
  roomMoreBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!activeRoomId) return;
    if (!roomContextMenu.hidden && contextRoomId === activeRoomId) {
      hideRoomMenu();
      return;
    }
    hideRoomHeaderPopovers({ except: 'more' });
    const rect = roomMoreBtn.getBoundingClientRect();
    showRoomMenu(activeRoomId, rect.right - 8, rect.bottom + 4, roomMoreBtn);
    roomMoreBtn.classList.add('is-active');
    roomMoreBtn.setAttribute('aria-expanded', 'true');
  });
  hangupCallBtn?.addEventListener('click', () => {
    void window.RelayVoip.hangup('user_hangup', true).then(() => {
      updateCallChrome();
      void refreshRooms();
    });
  });
  callDockHangupBtn?.addEventListener('click', () => {
    void window.RelayVoip.hangup('user_hangup', true).then(() => {
      updateCallChrome();
      void refreshRooms();
    });
  });
  callMuteBtn?.addEventListener('click', () => {
    window.RelayVoip?.toggleMute?.();
    updateCallChrome();
  });
  callDeafenBtn?.addEventListener('click', () => {
    window.RelayVoip?.toggleDeafen?.();
    updateCallChrome();
  });
  callVideoToggleBtn?.addEventListener('click', () => {
    window.RelayVoip?.toggleVideo?.();
    updateCallChrome();
  });
  callScreenBtn?.addEventListener('click', async () => {
    try {
      await window.RelayVoip?.toggleScreenShare?.();
    } catch (error) {
      window.alert(error?.message || String(error));
    }
    updateCallChrome();
  });
  callParticipantsToggle?.addEventListener('click', () => {
    callParticipantsOpen = !callParticipantsOpen;
    callParticipantsSection?.classList.toggle('is-collapsed', !callParticipantsOpen);
    callParticipantsToggle.setAttribute('aria-expanded', callParticipantsOpen ? 'true' : 'false');
  });
  incomingCallAccept?.addEventListener('click', async () => {
    try {
      await window.RelayVoip.answerCall();
      updateCallChrome();
      void refreshRooms();
    } catch (error) {
      alert(error.message || String(error));
      updateCallChrome();
    }
  });
  incomingCallReject?.addEventListener('click', () => {
    void window.RelayVoip.rejectCall().then(() => {
      updateCallChrome();
      void refreshRooms();
    });
  });

  joinRoomBtn?.addEventListener('click', () => openJoinDialog());
  invitesBtn?.addEventListener('click', () => toggleInvitesPanel());
  invitesPanelClose?.addEventListener('click', () => toggleInvitesPanel(false));
  dmCreateChatBtn?.addEventListener('click', () => {
    if (createChatOpen) closeCreateChat();
    else openCreateChat();
  });
  dmCreateChatHeadBtn?.addEventListener('click', () => {
    if (createChatOpen) closeCreateChat();
    else openCreateChat();
  });
  dmMessageSearchBtn?.addEventListener('click', () => {
    if (messageSearchOpen) closeMessageSearch();
    else openMessageSearch();
  });
  spaceLobbyBtn?.addEventListener('click', () => {
    if (forumOpen && forumThread) {
      forumThread = null;
      forumReplyToEventId = null;
      renderForum();
      return;
    }
    if ((lobbyOpen || forumOpen) && !messageSearchOpen) return;
    if (lobbySpaceSummary?.isForum) openForum();
    else openLobby();
  });
  spaceMessageSearchBtn?.addEventListener('click', () => {
    if (messageSearchOpen) {
      closeMessageSearch();
      if (String(activeSpaceFilter).startsWith('!')) {
        if (lobbySpaceSummary?.isForum) openForum();
        else openLobby();
      }
      return;
    }
    openMessageSearch();
  });
  forumPostCancel?.addEventListener('click', () => closeForumPostDialog());
  forumPostForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const topicRoomId = String(forumPostTopic?.value || '').trim();
    const title = String(forumPostTitle?.value || '').trim();
    const body = String(forumPostBody?.value || '').trim();
    if (!topicRoomId || !title || !body) return;
    if (forumPostError) {
      forumPostError.hidden = true;
      forumPostError.textContent = '';
    }
    if (forumPostSubmit) forumPostSubmit.disabled = true;
    try {
      await api(`/api/rooms/${encodeURIComponent(topicRoomId)}/forum-posts`, {
        method: 'POST',
        body: JSON.stringify({ title, body }),
      });
      closeForumPostDialog();
      await loadForumBoard();
    } catch (error) {
      if (forumPostError) {
        forumPostError.hidden = false;
        forumPostError.textContent = (error.message || String(error)).replace(/^MatrixError:\s*/i, '');
      }
    } finally {
      if (forumPostSubmit) forumPostSubmit.disabled = false;
    }
  });
  dmInvitesBtn?.addEventListener('click', () => toggleInvitesPanel());
  createChatForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const userId = String(createChatUserId?.value || '').trim();
    if (!userId) return;
    if (createChatError) {
      createChatError.hidden = true;
      createChatError.textContent = '';
    }
    if (createChatSubmit) createChatSubmit.disabled = true;
    try {
      const result = await api('/api/profile/dm', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          encrypted: Boolean(createChatEncrypted?.checked),
        }),
      });
      closeCreateChat();
      await setSpaceFilter('dms', { openFirst: false });
      activeRoomId = result.roomId;
      persistLastRoom(result.roomId);
      composerForm.hidden = false;
      await refreshRooms();
      const room = roomCatalog.find((entry) => entry.roomId === result.roomId);
      updateTimelineHead(room || { roomId: result.roomId, name: userId, isDirect: true, dmUserId: userId });
      updateCallChrome();
      setMembersPanelOpen(membersPanelOpen);
      await refreshMessages(result.roomId, { pinBottom: true });
    } catch (error) {
      if (createChatError) {
        createChatError.hidden = false;
        createChatError.textContent = (error.message || String(error)).replace(/^MatrixError:\s*/i, '');
      }
    } finally {
      if (createChatSubmit) createChatSubmit.disabled = false;
    }
  });

  notificationsEnabled?.addEventListener('change', () => {
    writeNotifPref('relay.notifications', notificationsEnabled.checked);
    if (notificationsEnabled.checked) void ensureNotificationPermission();
    updateNotificationsStatus();
  });
  notificationsInvites?.addEventListener('change', () => {
    writeNotifPref('relay.notifications.invites', notificationsInvites.checked);
  });
  notificationsSounds?.addEventListener('change', () => {
    writeNotifPref('relay.notifications.sounds', notificationsSounds.checked);
  });
  twitterEmojiEnabled?.addEventListener('change', () => {
    applyTwitterEmojiSetting(twitterEmojiEnabled.checked);
  });
  prefDeveloperTools?.addEventListener('change', () => {
    writeBoolPref('relay.developerTools', prefDeveloperTools.checked);
    applyDeveloperToolsVisibility();
    if (prefDeveloperTools.checked && accountDataExpanded) {
      void refreshAccountDataList();
    }
  });
  applyDeveloperToolsVisibility();
  devtoolsCopyTokenBtn?.addEventListener('click', async () => {
    try {
      const data = await api('/api/devtools/access-token');
      await navigator.clipboard.writeText(data.accessToken || '');
      const prev = devtoolsCopyTokenBtn.textContent;
      devtoolsCopyTokenBtn.textContent = 'Copied';
      window.setTimeout(() => {
        devtoolsCopyTokenBtn.textContent = prev || 'Copy';
      }, 1200);
    } catch (error) {
      window.alert(error.message || String(error));
    }
  });
  devtoolsAccountDataToggle?.addEventListener('click', () => {
    accountDataExpanded = !accountDataExpanded;
    if (devtoolsAccountDataBody) devtoolsAccountDataBody.hidden = !accountDataExpanded;
    if (devtoolsAccountDataToggle) {
      devtoolsAccountDataToggle.textContent = accountDataExpanded ? 'Collapse' : 'Expand';
    }
    if (accountDataExpanded) void refreshAccountDataList();
  });
  devtoolsAccountDataAddBtn?.addEventListener('click', () => {
    void openAccountDataEditor(null);
  });
  accountDataCancel?.addEventListener('click', () => {
    if (accountDataDialog?.open) accountDataDialog.close();
  });
  accountDataForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setAccountDataError('');
    const type =
      accountDataEditMode === 'create'
        ? String(accountDataTypeInput?.value || '').trim()
        : String(accountDataTypeInput?.value || accountDataDialogTitle?.textContent || '').trim();
    if (!type) {
      setAccountDataError('Event type is required');
      return;
    }
    let content;
    try {
      content = JSON.parse(String(accountDataContentInput?.value || '{}'));
    } catch {
      setAccountDataError('Content must be valid JSON');
      return;
    }
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      setAccountDataError('Content must be a JSON object');
      return;
    }
    try {
      if (accountDataEditMode === 'create') {
        await api('/api/devtools/account-data', {
          method: 'POST',
          body: JSON.stringify({ type, content }),
        });
      } else {
        await api(`/api/devtools/account-data/${encodeURIComponent(type)}`, {
          method: 'PUT',
          body: JSON.stringify({ content }),
        });
      }
      if (accountDataDialog?.open) accountDataDialog.close();
      await refreshAccountDataList();
    } catch (error) {
      setAccountDataError(error.message || String(error));
    }
  });
  prefAutoConvertEmoticons?.addEventListener('change', () => {
    writeBoolPref('relay.autoConvertEmoticons', prefAutoConvertEmoticons.checked);
  });
  defaultPackViewBtn?.addEventListener('click', () => {
    openStickerPackView(stickerPackState?.defaultPackId || 'builtin-emoji');
  });
  stickerPackViewClose?.addEventListener('click', () => {
    if (stickerPackViewDialog?.open) stickerPackViewDialog.close();
  });
  stickerPackSetDefaultBtn?.addEventListener('click', async () => {
    if (!viewingPackId) return;
    try {
      const data = await api('/api/stickers/default', {
        method: 'PUT',
        body: JSON.stringify({ packId: viewingPackId }),
      });
      applyStickerPackState(data);
      if (stickerPackViewDialog?.open) stickerPackViewDialog.close();
    } catch (error) {
      window.alert(error.message || String(error));
    }
  });
  favoritePackSelectBtn?.addEventListener('click', () => openFavoritePackDialog());
  favoritePackCancel?.addEventListener('click', () => {
    if (favoritePackDialog?.open) favoritePackDialog.close();
  });
  favoritePackForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const packIds = [...(favoritePackOptions?.querySelectorAll('input[type="checkbox"]:checked') || [])].map(
      (input) => input.value,
    );
    try {
      const data = await api('/api/stickers/favorites', {
        method: 'PUT',
        body: JSON.stringify({ packIds }),
      });
      applyStickerPackState(data);
      if (favoritePackDialog?.open) favoritePackDialog.close();
    } catch (error) {
      if (favoritePackError) {
        favoritePackError.hidden = false;
        favoritePackError.textContent = error.message || String(error);
      } else {
        window.alert(error.message || String(error));
      }
    }
  });
  telegramBotTokenInput?.addEventListener('input', () => {
    syncTelegramImportEnabled();
  });
  telegramBotTokenInput?.addEventListener('change', async () => {
    syncTelegramImportEnabled();
    try {
      await api('/api/stickers/telegram-token', {
        method: 'PUT',
        body: JSON.stringify({ token: telegramBotTokenInput.value.trim() }),
      });
      if (telegramImportStatus) telegramImportStatus.textContent = 'Bot token saved locally.';
    } catch (error) {
      if (telegramImportStatus) {
        telegramImportStatus.textContent = error.message || String(error);
      }
    }
  });
  telegramPackUrlInput?.addEventListener('input', () => syncTelegramImportEnabled());
  telegramImportBtn?.addEventListener('click', async () => {
    const token = String(telegramBotTokenInput?.value || '').trim();
    const url = String(telegramPackUrlInput?.value || '').trim();
    if (!token || !url) return;
    telegramImportBtn.disabled = true;
    if (telegramImportStatus) telegramImportStatus.textContent = 'Importing pack…';
    try {
      await api('/api/stickers/telegram-token', {
        method: 'PUT',
        body: JSON.stringify({ token }),
      });
      const data = await api('/api/stickers/telegram/import', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      applyStickerPackState(data);
      if (telegramPackUrlInput) telegramPackUrlInput.value = '';
      syncTelegramImportEnabled();
      if (telegramImportStatus) {
        telegramImportStatus.textContent = `Imported “${data.pack?.name || 'pack'}”.`;
      }
    } catch (error) {
      if (telegramImportStatus) {
        telegramImportStatus.textContent = error.message || String(error);
      }
      syncTelegramImportEnabled();
    }
  });

  notificationsTestBtn?.addEventListener('click', async () => {
    writeNotifPref('relay.notifications', true);
    if (notificationsEnabled) notificationsEnabled.checked = true;
    await showDesktopNotification({
      title: 'Kitsu',
      body: 'Test notification — you are set up.',
      roomId: activeRoomId,
    });
    updateNotificationsStatus();
  });
  notifKeywordSaveBtn?.addEventListener('click', async () => {
    const keyword = String(notifKeywordInput?.value || '').trim();
    if (!keyword) return;
    try {
      notifKeywordSaveBtn.disabled = true;
      if (notifRulesStatus) notifRulesStatus.textContent = 'Saving keyword…';
      const data = await api('/api/notifications/keywords', {
        method: 'POST',
        body: JSON.stringify({ keyword, mode: 'loud' }),
      });
      if (notifKeywordInput) notifKeywordInput.value = '';
      applyPushNotificationSettings(data);
      if (notifRulesStatus) notifRulesStatus.textContent = '';
    } catch (error) {
      if (notifRulesStatus) notifRulesStatus.textContent = error.message || String(error);
    } finally {
      notifKeywordSaveBtn.disabled = false;
    }
  });
  notifKeywordInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      notifKeywordSaveBtn?.click();
    }
  });
  audioInputSelect?.addEventListener('change', () => {
    window.RelayMediaPrefs?.set?.({ audioInput: audioInputSelect.value });
    stopMicMonitor();
  });
  audioOutputSelect?.addEventListener('change', async () => {
    window.RelayMediaPrefs?.set?.({ audioOutput: audioOutputSelect.value });
    const ok = await window.RelayMediaPrefs?.applyAudioOutput?.(remoteCallAudio);
    if (audioOutputStatus) {
      audioOutputStatus.textContent = ok === false ? 'Could not switch speaker on this platform.' : '';
    }
  });
  audioInputTestBtn?.addEventListener('click', () => void playMicTestTone());
  audioInputMonitorBtn?.addEventListener('click', () => void toggleMicMonitor());
  audioOutputTestBtn?.addEventListener('click', () => playSpeakerTestTone());
  prefNoiseSuppression?.addEventListener('change', () => {
    window.RelayMediaPrefs?.set?.({ noiseSuppression: prefNoiseSuppression.checked });
  });
  prefEchoCancellation?.addEventListener('change', () => {
    window.RelayMediaPrefs?.set?.({ echoCancellation: prefEchoCancellation.checked });
  });
  prefAutoGainControl?.addEventListener('change', () => {
    window.RelayMediaPrefs?.set?.({ autoGainControl: prefAutoGainControl.checked });
  });
  prefScreenResolution?.addEventListener('change', () => {
    window.RelayMediaPrefs?.set?.({ screenResolution: prefScreenResolution.value });
  });
  prefScreenBitrate?.addEventListener('change', () => {
    window.RelayMediaPrefs?.set?.({ screenBitrate: prefScreenBitrate.value });
  });
  prefScreenFps?.addEventListener('change', () => {
    window.RelayMediaPrefs?.set?.({ screenFps: prefScreenFps.value });
  });
  prefShowRemoteCursor?.addEventListener('change', () => {
    window.RelayMediaPrefs?.set?.({ showRemoteCursor: prefShowRemoteCursor.checked });
  });
  deviceVerificationBtn?.addEventListener('click', () => {
    void runCryptoSetup();
  });
  deviceBackupSetupBtn?.addEventListener('click', () => {
    void runCryptoSetup();
  });
  removeUnverifiedDevicesBtn?.addEventListener('click', async () => {
    let ids = [];
    try {
      ids = JSON.parse(removeUnverifiedDevicesBtn.dataset.deviceIds || '[]');
    } catch {
      ids = [];
    }
    if (!ids.length) return;
    if (
      !window.confirm(
        `Sign out ${ids.length} unverified device${ids.length === 1 ? '' : 's'}? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      removeUnverifiedDevicesBtn.disabled = true;
      const result = await removeDevicesWithPassword(ids, {
        label: `Enter your account password to remove ${ids.length} unverified device${ids.length === 1 ? '' : 's'}.`,
      });
      if (!result) return;
      await refreshDevicesSettings();
      void refreshSecurityBadge();
    } catch (error) {
      window.alert(error.message || String(error));
    } finally {
      removeUnverifiedDevicesBtn.disabled = false;
    }
  });

  function hideDeviceVerificationMenu() {
    if (!deviceVerificationMenu) return;
    deviceVerificationMenu.hidden = true;
    deviceVerificationMenuBtn?.setAttribute('aria-expanded', 'false');
  }

  function toggleDeviceVerificationMenu() {
    if (!deviceVerificationMenu) return;
    const open = deviceVerificationMenu.hidden;
    deviceVerificationMenu.hidden = !open;
    deviceVerificationMenuBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  deviceVerificationMenuBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleDeviceVerificationMenu();
  });
  deviceVerificationResetBtn?.addEventListener('click', () => {
    hideDeviceVerificationMenu();
    void runCryptoSetup({ reset: true });
  });
  document.addEventListener('click', (event) => {
    if (!deviceVerificationMenu || deviceVerificationMenu.hidden) return;
    const wrap = event.target?.closest?.('.device-security-menu');
    if (!wrap) hideDeviceVerificationMenu();
  });
  prefEnterForNewline?.addEventListener('change', () => {
    writeBoolPref('relay.enterForNewline', prefEnterForNewline.checked);
  });
  prefSpellcheck?.addEventListener('change', () => {
    writeBoolPref('relay.spellcheck', prefSpellcheck.checked);
    applySpellcheckPref();
  });
  prefMarkdownFormatting?.addEventListener('change', () => {
    writeBoolPref('relay.markdownFormatting', prefMarkdownFormatting.checked);
  });
  prefHideActivity?.addEventListener('change', () => {
    writeBoolPref('relay.hideActivity', prefHideActivity.checked);
    if (prefHideActivity.checked) void sendTypingState(false);
  });
  prefHour24?.addEventListener('change', () => {
    writeBoolPref('relay.hour24', prefHour24.checked);
    if (activeRoomId) void refreshMessages(activeRoomId, { quiet: true });
  });
  prefDateFormat?.addEventListener('change', () => {
    writeStringPref('relay.dateFormat', prefDateFormat.value);
    if (activeRoomId) void refreshMessages(activeRoomId, { quiet: true });
  });
  prefAutoJoinSpaceRooms?.addEventListener('change', () => {
    writeBoolPref('relay.autoJoinSpaceRooms', prefAutoJoinSpaceRooms.checked);
  });
  prefMessageLayout?.addEventListener('change', () => {
    writeStringPref('relay.messageLayout', prefMessageLayout.value);
    applyMessageLayoutPrefs();
  });
  prefMessageSpacing?.addEventListener('change', () => {
    writeStringPref('relay.messageSpacing', prefMessageSpacing.value);
    applyMessageLayoutPrefs();
  });
  prefScrollOnReselect?.addEventListener('change', () => {
    writeStringPref('relay.scrollOnReselect', prefScrollOnReselect.value);
  });
  prefLegacyUsernameColor?.addEventListener('change', () => {
    writeBoolPref('relay.legacyUsernameColor', prefLegacyUsernameColor.checked);
    if (activeRoomId) void refreshMessages(activeRoomId, { quiet: true });
  });
  prefHideMembership?.addEventListener('change', () => {
    writeBoolPref('relay.hideMembership', prefHideMembership.checked);
    if (activeRoomId) void refreshMessages(activeRoomId, { quiet: true });
  });
  prefHideProfileChange?.addEventListener('change', () => {
    writeBoolPref('relay.hideProfileChange', prefHideProfileChange.checked);
    if (activeRoomId) void refreshMessages(activeRoomId, { quiet: true });
  });
  prefDisableMediaAutoLoad?.addEventListener('change', () => {
    writeBoolPref('relay.disableMediaAutoLoad', prefDisableMediaAutoLoad.checked);
    if (activeRoomId) void refreshMessages(activeRoomId, { quiet: true });
  });
  prefUrlPreview?.addEventListener('change', () => {
    writeBoolPref('relay.urlPreview', prefUrlPreview.checked);
    if (activeRoomId) void refreshMessages(activeRoomId, { quiet: true });
  });
  prefUrlPreviewEncrypted?.addEventListener('change', () => {
    writeBoolPref('relay.urlPreviewEncrypted', prefUrlPreviewEncrypted.checked);
    if (activeRoomId) void refreshMessages(activeRoomId, { quiet: true });
  });
  prefShowHiddenEvents?.addEventListener('change', () => {
    writeBoolPref('relay.showHiddenEvents', prefShowHiddenEvents.checked);
    if (activeRoomId) void refreshMessages(activeRoomId, { quiet: true });
  });
  prefSystemTheme?.addEventListener('change', () => {
    writeBoolPref('relay.systemTheme', prefSystemTheme.checked);
    refreshActiveTheme();
  });
  prefMonochrome?.addEventListener('change', () => {
    writeBoolPref('relay.monochrome', prefMonochrome.checked);
    applyMonochromePref();
  });
  prefPageZoom?.addEventListener('change', () => {
    writeStringPref('relay.pageZoom', prefPageZoom.value || '100');
    applyPageZoomPref();
  });
  prefLanguage?.addEventListener('change', () => {
    writeStringPref('relay.language', prefLanguage.value || 'system');
    applyLanguagePref();
    if (activeRoomId) void refreshMessages(activeRoomId, { quiet: true });
  });
  prefTextSize?.addEventListener('change', () => {
    writeStringPref('relay.textSize', prefTextSize.value || 'normal');
    applyTextSizePref();
  });
  clearCacheBtn?.addEventListener('click', () => {
    if (!window.confirm('Clear local caches and reload Kitsu? Your login session is kept on the server.')) {
      return;
    }
    clearRelayCachesAndReload();
  });
  aboutSourceCodeBtn?.addEventListener('click', async () => {
    try {
      if (window.relayDesktop?.openSource) {
        await window.relayDesktop.openSource();
        return;
      }
      window.open('/README.md', '_blank', 'noopener,noreferrer');
    } catch (error) {
      window.alert(error.message || String(error));
    }
  });
  protocolRefreshBtn?.addEventListener('click', () => {
    void refreshProtocolHandlerStatus();
  });
  mobileCompanionRefreshBtn?.addEventListener('click', () => {
    void refreshMobileCompanionStatus();
  });
  protocolRepairBtn?.addEventListener('click', async () => {
    if (!window.relayDesktop?.repairProtocol) {
      window.alert('Protocol repair is only available in the Kitsu desktop app.');
      return;
    }
    try {
      if (protocolHandlerStatus) protocolHandlerStatus.textContent = 'Repairing protocol handler…';
      const status = await window.relayDesktop.repairProtocol();
      protocolHandlerStatus.textContent =
        status?.message || 'Protocol handler updated.';
    } catch (error) {
      if (protocolHandlerStatus) {
        protocolHandlerStatus.textContent = error.message || String(error);
      }
    }
  });

  if (window.relayDesktop?.onNotificationClick) {
    notifClickUnsub = window.relayDesktop.onNotificationClick((data) => {
      if (data?.roomId) void openRoomFromNotification(data.roomId);
    });
  }

  inviteUserCancel?.addEventListener('click', () => closeInviteDialog());
  inviteUserForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!inviteTarget) return;
    const userId = inviteUserInput.value.trim();
    if (!userId.startsWith('@') || !userId.includes(':')) {
      setInviteError('Use a full Matrix ID like @user:server');
      return;
    }
    setInviteError('');
    try {
      const path =
        inviteTarget.kind === 'space'
          ? `/api/spaces/${encodeURIComponent(inviteTarget.id)}/invite`
          : `/api/rooms/${encodeURIComponent(inviteTarget.id)}/invite`;
      await api(path, { method: 'POST', body: JSON.stringify({ userId }) });
      closeInviteDialog();
    } catch (error) {
      setInviteError((error.message || String(error)).replace(/^MatrixError:\s*/i, ''));
    }
  });

  joinRoomCancel?.addEventListener('click', () => closeJoinDialog());
  joinRoomForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = joinRoomInput.value.trim();
    if (!id) {
      setJoinError('Enter a room ID, alias, or link');
      return;
    }
    setJoinError('');
    try {
      const result = await api('/api/join', {
        method: 'POST',
        body: JSON.stringify({
          id,
          autoJoinSpaceRooms: autoJoinSpaceRoomsEnabled(),
        }),
      });
      closeJoinDialog();
      await refreshInvites();
      await refreshSpaces();
      await refreshRooms();
      if (result.isSpace) {
        setSpaceFilter(result.roomId);
      } else if (result.roomId) {
        activeRoomId = result.roomId;
        persistLastRoom(result.roomId);
        updateTimelineHead(
          result.summary ||
            roomCatalog.find((entry) => entry.roomId === result.roomId) || {
              roomId: result.roomId,
              name: result.roomId,
            },
        );
        composerForm.hidden = false;
        updateCallChrome();
        void refreshMessages(result.roomId);
        void refreshRooms();
      }
    } catch (error) {
      setJoinError((error.message || String(error)).replace(/^MatrixError:\s*/i, ''));
    }
  });

  window.RelayVoip?.on((event) => {
    if (event.type === 'speaking') {
      setSpeakingUsers(event.speakers || []);
      return;
    }
    if (
      event.type === 'state' ||
      event.type === 'ended' ||
      event.type === 'deafen' ||
      event.type === 'incoming' ||
      event.type === 'connected'
    ) {
      syncCallControl(event);
    }
    if (event.type === 'ended' || (event.type === 'state' && event.state === 'idle')) {
      setSpeakingUsers([]);
    }
    if (event.type === 'incoming') {
      voipPeerLabel = roomLabel(event.roomId);
      void showDesktopNotification({
        title: 'Incoming call',
        body: roomLabel(event.roomId),
        roomId: event.roomId,
      });
      if (event.roomId && event.roomId !== activeRoomId) {
        activeRoomId = event.roomId;
        persistLastRoom(event.roomId);
        updateTimelineHead(
          roomCatalog.find((entry) => entry.roomId === event.roomId) || {
            roomId: event.roomId,
            name: roomLabel(event.roomId),
          },
        );
        composerForm.hidden = false;
        void refreshMessages(event.roomId);
      }
    }
    if (event.type === 'local-stream' && event.stream) {
      if (localCallVideo) localCallVideo.srcObject = event.stream;
    }
    if (event.type === 'local-screen') {
      if (screenCallVideo) {
        screenCallVideo.srcObject = event.stream || null;
      }
      if (callScreenFrame) callScreenFrame.hidden = !event.stream;
      if (event.stream && localCallVideo && !localCallVideo.srcObject) {
        localCallVideo.srcObject = event.stream;
      }
      callMediaDock?.classList.toggle('is-screen-focus', Boolean(event.stream));
    }
    if (event.type === 'remote-stream' && event.stream) {
      if (remoteCallAudio) {
        remoteCallAudio.srcObject = event.stream;
        void window.RelayMediaPrefs?.applyAudioOutput?.(remoteCallAudio);
      }
      if (remoteCallVideo) remoteCallVideo.srcObject = event.stream;
      const videoTracks = event.stream.getVideoTracks?.() || [];
      if (videoTracks.length > 1 && screenCallVideo) {
        const screenOnly = new MediaStream([videoTracks[videoTracks.length - 1]]);
        screenCallVideo.srcObject = screenOnly;
        if (callScreenFrame) callScreenFrame.hidden = false;
        callMediaDock?.classList.add('is-screen-focus');
      }
    }
    if (event.type === 'deafen') {
      applyCallMediaMute(event.deafened);
    }
    if (event.type === 'error') {
      console.warn('[voip]', event.error);
    }
    updateCallChrome();
    void refreshRooms();
  });

  function wireDialogBackdropClose(dialog, onDismiss) {
    if (!dialog) return;
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      if (typeof onDismiss === 'function') onDismiss();
      else if (dialog.open) dialog.close();
    });
  }

  for (const dialog of document.querySelectorAll('dialog.space-dialog')) {
    wireDialogBackdropClose(dialog, () => {
      if (dialog === createSpaceDialog) closeCreateSpaceDialog();
      else if (dialog === joinRoomDialog) closeJoinDialog();
      else if (dialog === createChildDialog) closeCreateChildDialog();
      else if (dialog === inviteUserDialog) closeInviteDialog();
      else if (dialog === cryptoSetupDialog) closeCryptoSetupDialog();
      else if (dialog === accountPasswordDialog) closeAccountPasswordDialog();
      else if (dialog.open) dialog.close();
    });
  }

  void bootstrap();

  applySpellcheckPref();

  composerInput?.addEventListener('input', () => {
    scheduleDraftSave();
    updateComposerAutocomplete();
  });
  composerInput?.addEventListener('keydown', (event) => {
    if (!composerAutocomplete || composerAutocomplete.hidden) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      autocompleteState.index = (autocompleteState.index + 1) % Math.max(1, autocompleteState.items.length);
      renderComposerAutocomplete();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      autocompleteState.index =
        (autocompleteState.index - 1 + autocompleteState.items.length) %
        Math.max(1, autocompleteState.items.length);
      renderComposerAutocomplete();
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      if (autocompleteState.items.length) {
        event.preventDefault();
        applyComposerAutocomplete();
      }
    } else if (event.key === 'Escape') {
      hideComposerAutocomplete();
    }
  });
  composerInput?.addEventListener('blur', () => {
    window.setTimeout(() => hideComposerAutocomplete(), 120);
  });

  forwardMessageSearch?.addEventListener('input', () => {
    renderForwardRoomList(forwardMessageSearch.value);
  });
  forwardMessageCancel?.addEventListener('click', () => forwardMessageDialog?.close?.());
  forwardMessageForm?.addEventListener('submit', (event) => event.preventDefault());

  roomSettingsCancel?.addEventListener('click', () => roomSettingsDialog?.close?.());
  roomSettingsForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!roomSettingsRoomId) return;
    if (roomSettingsError) {
      roomSettingsError.hidden = true;
      roomSettingsError.textContent = '';
    }
    try {
      await api(`/api/rooms/${encodeURIComponent(roomSettingsRoomId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: roomSettingsName?.value,
          topic: roomSettingsTopic?.value,
          joinRule: roomSettingsJoinRule?.value,
        }),
      });
      roomSettingsDialog?.close?.();
      await refreshRooms();
      const room = roomCatalog.find((entry) => entry.roomId === roomSettingsRoomId);
      if (room) updateTimelineHead(room);
    } catch (error) {
      if (roomSettingsError) {
        roomSettingsError.hidden = false;
        roomSettingsError.textContent = (error.message || String(error)).replace(/^MatrixError:\s*/i, '');
      }
    }
  });

  sasVerifyMatch?.addEventListener('click', () => void confirmSas(true));
  sasVerifyMismatch?.addEventListener('click', () => void confirmSas(false));
  sasVerifyCancel?.addEventListener('click', () => {
    void confirmSas(false);
    sasVerifyDialog?.close?.();
  });

})();
