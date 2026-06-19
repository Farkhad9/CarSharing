import { useState } from 'react';
import { FaInstagram, FaTwitter, FaLinkedinIn } from 'react-icons/fa';
import { FiArrowRight, FiMail, FiX } from 'react-icons/fi';

const footerModalContent = {
    careers: {
        title: 'Careers',
        body: 'We are not hiring through the website yet. Send your CV to careers@electrostreet.az and our team will contact you when a matching role opens.',
    },
    press: {
        title: 'Press',
        body: 'For media questions, interviews, and brand materials, contact press@electrostreet.az.',
    },
    help: {
        title: 'Help Center',
        body: 'Need help with a ride, payment, or document verification? Open your personal cabinet and use the Support tab for live chat.',
        actionLabel: 'Open cabinet',
        actionHref: '/dashboard',
    },
    privacy: {
        title: 'Privacy Policy',
        body: 'ElectroStreet stores account, booking, payment, and support data only to operate the car-sharing service and improve safety.',
    },
    terms: {
        title: 'Terms of Service',
        body: 'By using ElectroStreet you agree to follow booking rules, return cars in good condition, and pay the active rate for every ride.',
    },
    cookies: {
        title: 'Cookie settings',
        body: 'This demo uses local browser storage for login, reservations, and preferences. No marketing cookie panel is enabled yet.',
    },
};

const Footer = () => {
    const [activeModal, setActiveModal] = useState(null);
    const [email, setEmail] = useState('');
    const [subscribeMessage, setSubscribeMessage] = useState('');

    const openModal = (key) => setActiveModal(footerModalContent[key]);

    const handleSubscribe = (event) => {
        event.preventDefault();
        const cleanEmail = email.trim();

        if (!cleanEmail) {
            setSubscribeMessage('Enter your email first.');
            return;
        }

        setSubscribeMessage(`Thanks. Updates will be sent to ${cleanEmail}.`);
        setEmail('');
    };

    return (
        <footer className="bg-zinc-950 text-zinc-50 pt-20 pb-10 border-t border-zinc-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Top CTA Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-800 pb-16 mb-16">
                    <div className="max-w-2xl mb-8 md:mb-0">
                        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
                            Ready to electrify your ride?
                        </h2>
                        <p className="text-zinc-400 text-lg">
                            Join thousands of drivers in Baku. No keys, no fuel, no compromises.
                        </p>
                    </div>
                    <button type="button" className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-300 bg-red-600 rounded-full hover:bg-red-500 hover:shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                        <span>Download the App</span>
                        <FiArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                </div>

                {/* Main Footer Content */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">

                    {/* Brand Column (takes up 4 columns on desktop) */}
                    <div className="lg:col-span-4">
                        <div className="text-2xl font-black tracking-tighter flex items-center gap-2 mb-6">
                            <span className="text-red-500">ELECTRO</span>STREET
                        </div>
                        <p className="text-zinc-400 leading-relaxed mb-8 max-w-sm">
                            The premier electric car-sharing network. Redefining urban mobility with sustainable, premium vehicles available on demand.
                        </p>
                        {/* Social Icons */}
                        <div className="flex items-center gap-4">
                            <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Open ElectroStreet on Instagram" className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 transition-all duration-300 hover:bg-red-600 hover:text-white hover:border-red-600">
                                <FaInstagram className="w-4 h-4" />
                            </a>
                            <a href="https://x.com/" target="_blank" rel="noreferrer" aria-label="Open ElectroStreet on X" className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 transition-all duration-300 hover:bg-red-600 hover:text-white hover:border-red-600">
                                <FaTwitter className="w-4 h-4" />
                            </a>
                            <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer" aria-label="Open ElectroStreet on LinkedIn" className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 transition-all duration-300 hover:bg-red-600 hover:text-white hover:border-red-600">
                                <FaLinkedinIn className="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    {/* Links Columns */}
                    <div className="lg:col-span-2">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-100 mb-6">Company</h4>
                        <ul className="space-y-4">
                            <li><a href="/about" className="text-zinc-400 hover:text-white transition-colors duration-200">About Us</a></li>
                            <li><a href="/#fleet" className="text-zinc-400 hover:text-white transition-colors duration-200">Our Fleet</a></li>
                            <li><button type="button" onClick={() => openModal('careers')} className="text-left text-zinc-400 hover:text-white transition-colors duration-200">Careers</button></li>
                            <li><button type="button" onClick={() => openModal('press')} className="text-left text-zinc-400 hover:text-white transition-colors duration-200">Press</button></li>
                        </ul>
                    </div>

                    <div className="lg:col-span-2">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-100 mb-6">Service</h4>
                        <ul className="space-y-4">
                            <li><a href="/pricing" className="text-zinc-400 hover:text-white transition-colors duration-200">Pricing</a></li>
                            <li><a href="/charging" className="text-zinc-400 hover:text-white transition-colors duration-200">Charging</a></li>
                            <li><button type="button" onClick={() => openModal('help')} className="text-left text-zinc-400 hover:text-white transition-colors duration-200">Help Center</button></li>
                        </ul>
                    </div>

                    {/* Newsletter Column */}
                    <div className="lg:col-span-4 lg:pl-8">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-100 mb-6">Stay Updated</h4>
                        <p className="text-zinc-400 mb-4">Subscribe to get notified about new parking zones and special rates.</p>
                        <form onSubmit={handleSubscribe} className="relative mt-4">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <FiMail className="h-5 w-5 text-zinc-500" />
                            </div>
                            <input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="Enter your email"
                                className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl py-3 pl-12 pr-32 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all placeholder:text-zinc-600"
                            />
                            <button type="submit" className="absolute right-1.5 top-1.5 bottom-1.5 px-6 bg-white text-zinc-950 font-bold rounded-lg hover:bg-zinc-200 transition-colors">
                                Subscribe
                            </button>
                        </form>
                        {subscribeMessage && (
                            <p className="mt-3 text-sm font-semibold text-red-300">{subscribeMessage}</p>
                        )}
                    </div>

                </div>

                {/* Bottom Bar */}
                <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-zinc-800/50 text-sm text-zinc-500">
                    <p>&copy; {new Date().getFullYear()} ElectroStreet. All rights reserved.</p>
                    <div className="flex space-x-6 mt-4 md:mt-0">
                        <button type="button" onClick={() => openModal('privacy')} className="hover:text-zinc-300 transition-colors">Privacy Policy</button>
                        <button type="button" onClick={() => openModal('terms')} className="hover:text-zinc-300 transition-colors">Terms of Service</button>
                        <button type="button" onClick={() => openModal('cookies')} className="hover:text-zinc-300 transition-colors">Cookie settings</button>
                    </div>
                </div>

            </div>

            {activeModal && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-white shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <h3 className="text-2xl font-black">{activeModal.title}</h3>
                            <button
                                type="button"
                                onClick={() => setActiveModal(null)}
                                className="rounded-full bg-white/10 p-2 text-zinc-300 transition hover:bg-white/20 hover:text-white"
                                aria-label="Close dialog"
                            >
                                <FiX />
                            </button>
                        </div>
                        <p className="mt-4 leading-7 text-zinc-300">{activeModal.body}</p>
                        <div className="mt-6 flex justify-end gap-3">
                            {activeModal.actionHref && (
                                <a href={activeModal.actionHref} className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500">
                                    {activeModal.actionLabel}
                                </a>
                            )}
                            <button
                                type="button"
                                onClick={() => setActiveModal(null)}
                                className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-black text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </footer>
    );
};

export default Footer;
