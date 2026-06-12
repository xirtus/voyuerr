import PageTitle from '@app/components/Common/PageTitle';
import PrivacySettings from '@app/components/PrivacySettings';
import UserProfile from '@app/components/UserProfile';
import type { NextPage } from 'next';

const PrivacyPage: NextPage = () => {
  return (
    <UserProfile>
      <PageTitle title="Privacy Settings" />
      <PrivacySettings />
    </UserProfile>
  );
};

export default PrivacyPage;
