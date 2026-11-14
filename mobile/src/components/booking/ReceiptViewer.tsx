import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, IconButton } from '@/components/ui';

type ReceiptViewerProps = {
  /** The receipt's imageUrl from the server: an https link or a data:image URL. */
  uri: string | null;
  visible: boolean;
  onClose: () => void;
  title?: string;
};

/** A receipt URL the viewer can draw: https, or a non-SVG data:image URL. */
export function isViewableReceipt(uri: unknown): uri is string {
  if (typeof uri !== 'string') return false;
  // The server already refuses SVG; skip it here too.
  if (uri.startsWith('data:image/svg')) return false;
  return uri.startsWith('https://') || uri.startsWith('data:image/');
}

/**
 * Shows a payment receipt full screen inside the app. Older receipts are
 * stored as base64 data URLs, which the phone's browser can't open, so they
 * are drawn here with expo-image like https ones.
 */
export function ReceiptViewer({ uri, visible, onClose, title = 'Payment receipt' }: ReceiptViewerProps) {
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (visible) setFailed(false);
  }, [visible, uri]);

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <AppText variant="headline" style={styles.title} accessibilityRole="header">
            {title}
          </AppText>
          <IconButton icon="close" label="Close receipt" onPress={onClose} variant="onHero" />
        </View>

        {uri && isViewableReceipt(uri) && !failed ? (
          <Image
            source={{ uri }}
            style={styles.image}
            contentFit="contain"
            transition={150}
            accessibilityLabel={title}
            onError={() => setFailed(true)}
          />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="image-outline" size={36} color="#c8dcd2" />
            <AppText align="center" style={styles.emptyText}>
              This receipt can't be shown on the phone.
            </AppText>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Always dark, like a photo viewer, whatever the app theme.
  root: {
    flex: 1,
    backgroundColor: '#070e0c',
    paddingHorizontal: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    flex: 1,
    color: '#ffffff',
  },
  image: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    color: '#c8dcd2',
  },
});
