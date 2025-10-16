export interface Schema {
  name: string;
  directory?: string;
  routing?: boolean;
  style?: 'css' | 'scss' | 'sass' | 'less';
  standalone?: boolean;
  zoneless?: boolean;
  skipInstall?: boolean;
}
