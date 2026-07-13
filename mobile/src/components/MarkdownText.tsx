import React from 'react';
import { Text, TextStyle } from 'react-native';

interface Props {
  style?: TextStyle | TextStyle[];
  boldStyle?: TextStyle;
  children: string;
  numberOfLines?: number;
}

export default function MarkdownText({ style, boldStyle, children, numberOfLines }: Props) {
  const parts = children.split(/(\*\*[^*]+\*\*)/g);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={i} style={[style, { fontWeight: '800' }, boldStyle]}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}
