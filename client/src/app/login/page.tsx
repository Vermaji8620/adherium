import LoginForm from './LoginForm';

type LoginPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return (
    <LoginForm
      showUnauthenticatedMessage={params.reason === 'unauthenticated'}
    />
  );
}
