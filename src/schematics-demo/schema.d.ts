export interface Schema {
  name: string;
  directory?: string;
  routing?: boolean;
  style?: 'css' | 'scss' | 'sass' | 'less';
  standalone?: boolean;
  zoneless?: boolean;
  skipInstall?: boolean;
  zendeskDisplayName?: string;
  zendeskAuthorName?: string;
  zendeskAuthorEmail?: string;
  zendeskDefaultLocale?: string;
  zendeskShortDescription?: string;
  zendeskLongDescription?: string;
}
