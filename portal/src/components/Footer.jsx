export default function Footer({ repo = 'kiro-account-manager' }) {
  return (
    <footer className="py-8 px-4 border-t border-white/10">
      <div className="max-w-6xl mx-auto text-center text-gray-500 text-sm">
        <p>Made with ❤️ by hj01857655</p>
        <p className="mt-2">
          <a 
            href={`https://github.com/hj01857655/${repo}/blob/main/LICENSE`}
            className="hover:text-white"
          >
            CC BY-NC-SA 4.0 License
          </a>
          <span className="mx-2">•</span>
          <span>⚠️ 本项目永久免费，如有人收费即为诈骗</span>
        </p>
      </div>
    </footer>
  )
}
