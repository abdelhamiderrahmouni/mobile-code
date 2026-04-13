import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MODELS } from './src/constants';
import { sendChatMessage } from './src/api';
import { loadState, saveState } from './src/storage';
import { AppSettings, ChatMessage, Session } from './src/types';

type Screen = 'sessions' | 'chat' | 'models' | 'settings';

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeSessionTitle(index: number): string {
  return `Session ${index + 1}`;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('sessions');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [favoriteModelIds, setFavoriteModelIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    serverUrl: '',
    defaultModelId: MODELS[0].id,
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [serverUrlDraft, setServerUrlDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const state = await loadState();
      if (!active) {
        return;
      }
      setSessions(state.sessions);
      setFavoriteModelIds(state.favoriteModelIds);
      setSettings(state.settings);
      setServerUrlDraft(state.settings.serverUrl);
      setCurrentSessionId(state.sessions[0]?.id ?? null);
      setIsLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    const persist = async () => {
      await saveState({ sessions, favoriteModelIds, settings });
    };
    void persist();
  }, [favoriteModelIds, isLoading, sessions, settings]);

  const sortedModels = useMemo(() => {
    const favSet = new Set(favoriteModelIds);
    return [...MODELS].sort((a, b) => {
      const af = favSet.has(a.id) ? 0 : 1;
      const bf = favSet.has(b.id) ? 0 : 1;
      return af - bf || a.name.localeCompare(b.name);
    });
  }, [favoriteModelIds]);

  const currentSession = useMemo(
    () => sessions.find((item) => item.id === currentSessionId) ?? null,
    [currentSessionId, sessions],
  );

  const activeSessions = useMemo(() => sessions.filter((item) => !item.archived), [sessions]);
  const archivedSessions = useMemo(() => sessions.filter((item) => item.archived), [sessions]);

  const createSession = () => {
    const session: Session = {
      id: makeId('session'),
      title: makeSessionTitle(sessions.length),
      updatedAt: new Date().toISOString(),
      archived: false,
      modelId: settings.defaultModelId,
      messages: [],
    };

    setSessions((prev) => [session, ...prev]);
    setCurrentSessionId(session.id);
    setScreen('chat');
  };

  const updateSession = (id: string, updater: (session: Session) => Session) => {
    setSessions((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  };

  const toggleArchiveSession = (id: string) => {
    updateSession(id, (session) => ({
      ...session,
      archived: !session.archived,
      updatedAt: new Date().toISOString(),
    }));
  };

  const deleteSession = (id: string) => {
    Alert.alert('Delete session', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSessions((prev) => prev.filter((item) => item.id !== id));
          setCurrentSessionId((prev) => (prev === id ? null : prev));
        },
      },
    ]);
  };

  const saveSettings = () => {
    setSettings((prev) => ({ ...prev, serverUrl: serverUrlDraft.trim() }));
    Alert.alert('Saved', 'Server settings saved successfully.');
  };

  const toggleFavoriteModel = (modelId: string) => {
    setFavoriteModelIds((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId],
    );
  };

  const selectDefaultModel = (modelId: string) => {
    setSettings((prev) => ({ ...prev, defaultModelId: modelId }));
  };

  const assignSessionModel = (modelId: string) => {
    if (!currentSession) {
      return;
    }
    updateSession(currentSession.id, (session) => ({ ...session, modelId }));
  };

  const sendMessage = async () => {
    const text = draftMessage.trim();
    if (!text || !currentSession || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: makeId('msg'),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    const placeholderMessage: ChatMessage = {
      id: makeId('msg'),
      role: 'assistant',
      content: 'Thinking…',
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setDraftMessage('');
    setIsSending(true);

    updateSession(currentSession.id, (session) => ({
      ...session,
      updatedAt: new Date().toISOString(),
      messages: [...session.messages, userMessage, placeholderMessage],
    }));

    try {
      const response = await sendChatMessage({
        serverUrl: settings.serverUrl,
        sessionId: currentSession.id,
        message: text,
        modelId: currentSession.modelId,
      });

      updateSession(currentSession.id, (session) => ({
        ...session,
        updatedAt: new Date().toISOString(),
        messages: session.messages.map((message) =>
          message.id === placeholderMessage.id
            ? {
                ...message,
                content: response.reply,
                pending: false,
              }
            : message,
        ),
      }));
    } catch (error) {
      const failure = error instanceof Error ? error.message : 'Unknown error';
      updateSession(currentSession.id, (session) => ({
        ...session,
        updatedAt: new Date().toISOString(),
        messages: session.messages.map((message) =>
          message.id === placeholderMessage.id
            ? {
                ...message,
                content: `Failed: ${failure}`,
                pending: false,
              }
            : message,
        ),
      }));
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#5b8cff" />
        <Text style={styles.subtitle}>Loading mobile-code...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>mobile-code</Text>
        <Text style={styles.subtitle}>React Native + Expo port of moCODE</Text>
      </View>

      <View style={styles.tabs}>
        {(
          [
            ['sessions', 'Sessions'],
            ['chat', 'Chat'],
            ['models', 'Models'],
            ['settings', 'Settings'],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setScreen(value)}
            style={[styles.tabButton, screen === value && styles.tabButtonActive]}
          >
            <Text style={styles.tabText}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {screen === 'sessions' && (
        <ScrollView style={styles.section} contentContainerStyle={styles.sectionContent}>
          <Pressable onPress={createSession} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>+ New session</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>Active sessions</Text>
          {activeSessions.length === 0 ? (
            <Text style={styles.emptyText}>No active sessions yet.</Text>
          ) : (
            activeSessions.map((session) => (
              <View key={session.id} style={styles.card}>
                <Pressable
                  onPress={() => {
                    setCurrentSessionId(session.id);
                    setScreen('chat');
                  }}
                >
                  <Text style={styles.cardTitle}>{session.title}</Text>
                  <Text style={styles.cardMeta}>
                    {session.messages.length} messages · model {session.modelId}
                  </Text>
                </Pressable>

                <View style={styles.rowGap}>
                  <Pressable
                    onPress={() => toggleArchiveSession(session.id)}
                    style={[styles.secondaryButton, styles.inlineButton]}
                  >
                    <Text style={styles.secondaryButtonText}>Archive</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => deleteSession(session.id)}
                    style={[styles.secondaryButton, styles.inlineButton]}
                  >
                    <Text style={styles.secondaryButtonText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}

          {archivedSessions.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Archived sessions</Text>
              {archivedSessions.map((session) => (
                <View key={session.id} style={styles.cardMuted}>
                  <Text style={styles.cardTitle}>{session.title}</Text>
                  <View style={styles.rowGap}>
                    <Pressable
                      onPress={() => toggleArchiveSession(session.id)}
                      style={[styles.secondaryButton, styles.inlineButton]}
                    >
                      <Text style={styles.secondaryButtonText}>Restore</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => deleteSession(session.id)}
                      style={[styles.secondaryButton, styles.inlineButton]}
                    >
                      <Text style={styles.secondaryButtonText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {screen === 'chat' && (
        <View style={styles.section}>
          {!currentSession ? (
            <View style={styles.centerFill}>
              <Text style={styles.emptyText}>Create a session first to start chatting.</Text>
              <Pressable onPress={createSession} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Create session</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.chatHeader}>
                <Text style={styles.sectionTitle}>{currentSession.title}</Text>
                <Text style={styles.cardMeta}>Model: {currentSession.modelId}</Text>
              </View>

              <FlatList
                data={currentSession.messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messageList}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.messageBubble,
                      item.role === 'user' ? styles.userBubble : styles.assistantBubble,
                    ]}
                  >
                    <Text style={styles.messageRole}>{item.role.toUpperCase()}</Text>
                    <Text style={styles.messageText}>{item.content}</Text>
                    {item.pending && <ActivityIndicator size="small" color="#9ab1ff" />}
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No messages yet.</Text>}
              />

              <View style={styles.composerRow}>
                <TextInput
                  style={styles.composerInput}
                  placeholder="Ask moCODE..."
                  placeholderTextColor="#7f88a3"
                  value={draftMessage}
                  onChangeText={setDraftMessage}
                  multiline
                />
                <Pressable onPress={sendMessage} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>{isSending ? '...' : 'Send'}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}

      {screen === 'models' && (
        <ScrollView style={styles.section} contentContainerStyle={styles.sectionContent}>
          <Text style={styles.sectionTitle}>Model registry</Text>
          {sortedModels.map((model) => {
            const isDefault = settings.defaultModelId === model.id;
            const isCurrentSessionModel = currentSession?.modelId === model.id;
            const isFavorite = favoriteModelIds.includes(model.id);

            return (
              <View key={model.id} style={styles.card}>
                <Text style={styles.cardTitle}>{model.name}</Text>
                <Text style={styles.cardMeta}>{model.provider}</Text>
                <View style={styles.rowGapWrap}>
                  <Pressable
                    onPress={() => toggleFavoriteModel(model.id)}
                    style={[styles.secondaryButton, styles.inlineButton]}
                  >
                    <Text style={styles.secondaryButtonText}>{isFavorite ? '★ Favorite' : '☆ Favorite'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => selectDefaultModel(model.id)}
                    style={[styles.secondaryButton, styles.inlineButton, isDefault && styles.secondaryButtonActive]}
                  >
                    <Text style={styles.secondaryButtonText}>Default {isDefault ? '✓' : ''}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => assignSessionModel(model.id)}
                    style={[
                      styles.secondaryButton,
                      styles.inlineButton,
                      isCurrentSessionModel && styles.secondaryButtonActive,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Session {isCurrentSessionModel ? '✓' : ''}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {screen === 'settings' && (
        <ScrollView style={styles.section} contentContainerStyle={styles.sectionContent}>
          <Text style={styles.sectionTitle}>Server configuration</Text>
          <Text style={styles.cardMeta}>Set your local or remote AI coding server URL.</Text>
          <TextInput
            value={serverUrlDraft}
            onChangeText={setServerUrlDraft}
            placeholder="https://your-server.com"
            placeholderTextColor="#7f88a3"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.textInput}
          />

          <Pressable onPress={saveSettings} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Save settings</Text>
          </Pressable>

          <View style={styles.cardMuted}>
            <Text style={styles.cardTitle}>Current defaults</Text>
            <Text style={styles.cardMeta}>Default model: {settings.defaultModelId}</Text>
            <Text style={styles.cardMeta}>Server URL: {settings.serverUrl || 'Not configured'}</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1220',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  centerFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#242946',
  },
  title: {
    color: '#edf2ff',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9aa4c5',
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#242946',
  },
  tabButton: {
    backgroundColor: '#1a1f36',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tabButtonActive: {
    backgroundColor: '#30489b',
  },
  tabText: {
    color: '#dce5ff',
    fontWeight: '600',
    fontSize: 12,
  },
  section: {
    flex: 1,
  },
  sectionContent: {
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: '#edf2ff',
    fontWeight: '700',
    fontSize: 16,
  },
  emptyText: {
    color: '#9aa4c5',
  },
  card: {
    backgroundColor: '#171c2f',
    borderRadius: 10,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#242946',
  },
  cardMuted: {
    backgroundColor: '#121629',
    borderRadius: 10,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#1d233f',
  },
  cardTitle: {
    color: '#edf2ff',
    fontWeight: '700',
  },
  cardMeta: {
    color: '#9aa4c5',
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: '#4566d8',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 9,
    alignSelf: 'flex-start',
  },
  primaryButtonText: {
    color: '#f6f8ff',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#202848',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  secondaryButtonActive: {
    backgroundColor: '#2f4a9a',
  },
  secondaryButtonText: {
    color: '#dce5ff',
    fontSize: 12,
    fontWeight: '600',
  },
  inlineButton: {
    alignSelf: 'flex-start',
  },
  rowGap: {
    flexDirection: 'row',
    gap: 8,
  },
  rowGapWrap: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chatHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 2,
  },
  messageList: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  messageBubble: {
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  userBubble: {
    backgroundColor: '#2f4a9a',
    alignSelf: 'flex-end',
    maxWidth: '90%',
  },
  assistantBubble: {
    backgroundColor: '#1b213c',
    alignSelf: 'flex-start',
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: '#273054',
  },
  messageRole: {
    color: '#9fb4ff',
    fontSize: 11,
    fontWeight: '700',
  },
  messageText: {
    color: '#eff4ff',
    lineHeight: 20,
  },
  composerRow: {
    borderTopWidth: 1,
    borderTopColor: '#242946',
    padding: 12,
    gap: 8,
  },
  composerInput: {
    minHeight: 64,
    maxHeight: 140,
    backgroundColor: '#171c2f',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#273054',
    color: '#edf2ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textInput: {
    backgroundColor: '#171c2f',
    borderWidth: 1,
    borderColor: '#273054',
    borderRadius: 10,
    color: '#edf2ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
