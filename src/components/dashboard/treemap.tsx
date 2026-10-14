// Entities Map — a flexbox treemap matching the web's renderEntMap (spec §9):
// two columns, the first two entities fill the left column and the rest the
// right, each column weighted by the sum of its tiles and each tile's area ∝
// its value. Colors are fixed per entity type (the tile color IS the encoding).
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type EntityTile = { name: string; value: number; color: string };

function Tile({ tile, onPress }: { tile: EntityTile; onPress?: () => void }) {
  // Alias out of the style literal: Reanimated's Babel plugin warns on any
  // `.value` inside an inline style object, and `tile.value` is plain data.
  const grow = tile.value;
  const inner = (
    <View style={[styles.tile, { flexGrow: grow, backgroundColor: tile.color }]}>
      <Text style={styles.tileText} numberOfLines={2}>
        {tile.name} ({tile.value.toFixed(2)}%)
      </Text>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tileWrap, pressed && styles.pressed]}>
      {inner}
    </Pressable>
  ) : (
    <View style={styles.tileWrap}>{inner}</View>
  );
}

export function EntitiesTreemap({
  tiles,
  height = 220,
  onSelect,
}: {
  tiles: EntityTile[];
  height?: number;
  onSelect?: (i: number) => void;
}) {
  const left = tiles.slice(0, 2);
  const right = tiles.slice(2);
  const leftFlex = left.reduce((s, t) => s + t.value, 0) || 1;
  const rightFlex = right.reduce((s, t) => s + t.value, 0) || 1;

  return (
    <View style={[styles.map, { height }]}>
      <View style={[styles.col, { flexGrow: leftFlex }]}>
        {left.map((t, i) => (
          <Tile key={t.name} tile={t} onPress={onSelect ? () => onSelect(i) : undefined} />
        ))}
      </View>
      {right.length > 0 ? (
        <View style={[styles.col, { flexGrow: rightFlex }]}>
          {right.map((t, i) => (
            <Tile key={t.name} tile={t} onPress={onSelect ? () => onSelect(i + 2) : undefined} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flexDirection: 'row',
    gap: 3,
    width: '100%',
  },
  col: {
    flexBasis: 0,
    gap: 3,
  },
  tileWrap: {
    flexGrow: 1,
    flexBasis: 0,
  },
  tile: {
    flexBasis: 0,
    borderRadius: 6,
    padding: 8,
    justifyContent: 'flex-end',
    minHeight: 34,
  },
  tileText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.8,
  },
});
