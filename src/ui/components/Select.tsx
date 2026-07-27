/**
 * A dropdown select.
 *
 * Replaces the horizontal chip row for category: chips stop working once a shop
 * has more than a handful of categories (they scroll off-screen and the current
 * selection can end up hidden). A dropdown shows the current value at all times
 * and scales to any number of options.
 *
 * Rendered in a Modal rather than an absolutely-positioned view so it is never
 * clipped by a parent's `overflow` or covered by the floating tab bar.
 */

import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../hooks/useResponsive';
import { Divider, Row, Spacer, Txt } from './common';
import { MIN_TOUCH_TARGET } from '../../config/constants';

export interface SelectOption<T extends string | null> {
  value: T;
  label: string;
  /** Optional trailing hint, e.g. a count. */
  hint?: string;
}

export function Select<T extends string | null>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  icon = 'pricetag-outline',
  error,
  title,
  /** Lets the user type a value that isn't in the list yet. */
  onCreate,
  createLabel = 'Add new',
}: {
  label?: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  error?: string;
  title?: string;
  onCreate?: () => void;
  createLabel?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value);

  /**
   * A value that isn't in `options` yet — e.g. a category the user is typing
   * for the first time — must still be shown. Falling back to the placeholder
   * made the trigger read "Uncategorised" while a real value was set, which
   * is a silent mismatch between what is displayed and what will be saved.
   */
  const displayLabel = selected?.label ?? (value ? String(value) : placeholder);
  const hasValue = selected !== undefined || Boolean(value);

  return (
    <View>
      {label ? (
        <>
          <Txt variant="label" color="muted">
            {label}
          </Txt>
          <Spacer size={theme.spacing.xs} />
        </>
      ) : null}

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? title ?? 'Select an option'}
        accessibilityValue={{ text: displayLabel }}
        style={({ pressed }) => [
          styles.trigger,
          {
            borderColor: error ? theme.colors.danger : theme.colors.border,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.lg,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Ionicons name={icon} size={18} color={theme.colors.textMuted} />
        <Txt
          style={{ flex: 1, marginLeft: 10 }}
          color={hasValue ? undefined : 'muted'}
          numberOfLines={1}
        >
          {displayLabel}
        </Txt>
        <Ionicons name="chevron-down" size={18} color={theme.colors.textMuted} />
      </Pressable>

      {error ? (
        <>
          <Spacer size={theme.spacing.xs} />
          <Txt variant="caption" color="danger">
            {error}
          </Txt>
        </>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* Tapping the scrim closes — expected behaviour for a dropdown. */}
        <Pressable
          style={[styles.scrim, { backgroundColor: theme.colors.overlay }]}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        >
          {/* Swallow taps inside the sheet so they don't close it. */}
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl },
            ]}
            onPress={() => {}}
          >
            <View style={styles.grabber} />
            <Spacer size={theme.spacing.md} />

            <Txt variant="heading" style={{ paddingHorizontal: theme.spacing.lg }}>
              {title ?? label ?? 'Select'}
            </Txt>
            <Spacer size={theme.spacing.md} />

            <FlatList
              data={options}
              keyExtractor={(option) => option.value ?? '__none__'}
              style={{ maxHeight: 380 }}
              ItemSeparatorComponent={() => <Divider />}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        paddingHorizontal: theme.spacing.lg,
                        backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
                      },
                    ]}
                  >
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Txt
                        style={{ flex: 1, fontWeight: active ? '700' : '400' }}
                        color={active ? 'primary' : undefined}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Txt>
                      {item.hint ? (
                        <Txt variant="caption" color="muted" style={{ marginRight: 8 }}>
                          {item.hint}
                        </Txt>
                      ) : null}
                      {active ? (
                        <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
                      ) : null}
                    </Row>
                  </Pressable>
                );
              }}
            />

            {onCreate ? (
              <>
                <Divider />
                <Pressable
                  onPress={() => {
                    setOpen(false);
                    onCreate();
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.option,
                    {
                      paddingHorizontal: theme.spacing.lg,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <Row gap={8}>
                    <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} />
                    <Txt color="primary" style={{ fontWeight: '700' }}>
                      {createLabel}
                    </Txt>
                  </Row>
                </Pressable>
              </>
            ) : null}

            <Spacer size={theme.spacing.xl} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET + 6,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    paddingTop: 10,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
  },
  option: { minHeight: MIN_TOUCH_TARGET + 8, justifyContent: 'center' },
});
