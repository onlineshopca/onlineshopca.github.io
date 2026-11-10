// Nojan · v93 · built 2026-11-09
/* v91: English / Français. Text on the page is written in English; when French is on,
   each piece of text is swapped for its French version from FR below (and swapped back for English).
   Language choice: 1) what the visitor picked (remembered on this device), else
   2) visitors in Quebec see French (checked once from their internet address — nothing is saved or sent to us), else English. */
(function(){
const FR = {
/* ---- top bar, menus, footer ---- */
"10% of our profit goes to the community.": "10 % de nos profits sont remis à la communauté.",
"Support us on GoFundMe ›": "Soutenez-nous sur GoFundMe ›",
"Main": "Principal", "Home": "Accueil", "Shop": "Boutique", "Services": "Services", "Events": "Événements", "Dating": "Rencontres",
"Homes": "Logements", "Support": "Aide", "Search": "Rechercher", "Hello, sign in": "Bonjour, connectez-vous", "Account": "Compte",
"Open cart": "Ouvrir le panier", "Search items and services": "Rechercher des articles et des services", "You are here": "Vous êtes ici",
"Contact us": "Nous joindre", "Copyright ©": "Droits d'auteur ©", "· No payment is taken online.": "· Aucun paiement n'est pris en ligne.",
"Back to top ↑": "Haut de page ↑", "More from Nojan": "Plus de Nojan", "Mobile": "Mobile", "Your bag is empty": "Votre sac est vide",
"Checkout ›": "Passer la commande ›", "Bag": "Sac",
"All items": "Tous les articles", "Shop by category": "Magasiner par catégorie", "See all items (": "Voir tous les articles (",
"Used items are coming soon": "Les articles d'occasion arrivent bientôt", "Shop by brand": "Magasiner par marque", "By condition": "Par état",
"Quick links": "Liens rapides", "Pickup & delivery": "Cueillette et livraison", "How ordering works": "Comment commander",
"Explore Services": "Découvrir les services", "Online classes": "Cours en ligne", "Small groups": "Petits groupes", "All services": "Tous les services",
"My bookings": "Mes réservations", "Offer a service": "Offrir un service", "Get help": "Obtenir de l'aide", "Paying for your order": "Payer votre commande",
"Questions & answers": "Questions et réponses", "Your account": "Votre compte", "Sign in": "Se connecter", "My orders & bookings": "Mes commandes et réservations",
"Follow us": "Suivez-nous", "Search brand new items": "Rechercher des articles neufs", "Search used items": "Rechercher des articles d'occasion",
"Search services": "Rechercher des services", "Added to your bag": "Ajouté à votre sac",
"Item": "Article", "Cart": "Panier", "Order sent": "Commande envoyée", "Booking sent": "Réservation envoyée", "Service": "Service", "Profile": "Profil", "My profile": "Mon profil",
"Language / Langue": "Langue / Language",
/* ---- home ---- */
"Nojan home": "Accueil Nojan", "Welcome to Nojan": "Bienvenue chez Nojan", "Your community, all in one place.": "Votre communauté, au même endroit.",
"Shop great brands for less and book classes and local services. Built in Richmond Hill, giving back to the community.":
  "De grandes marques à petit prix, des cours et des services locaux à réserver. Né à Richmond Hill, au service de la communauté.",
"Search Nojan": "Rechercher sur Nojan", "Support Nojan on GoFundMe": "Soutenez Nojan sur GoFundMe", "We're just starting": "Nous commençons à peine",
"Help us build a business that gives back": "Aidez-nous à bâtir une entreprise qui redonne",
"10% of our profit goes to the community. Give $20 and become one of our founding donors.":
  "10 % de nos profits sont remis à la communauté. Donnez 20 $ et devenez l'un de nos donateurs fondateurs.",
"Be the first to donate": "Soyez le premier à donner", "Donate on GoFundMe": "Donner sur GoFundMe", "Share": "Partager", "Explore Nojan": "Découvrir Nojan",
"Coming soon": "Bientôt", "Community": "Communauté", "New and used items": "Articles neufs et d'occasion", "Classes and local help": "Cours et aide locale",
"Things to do nearby": "Activités à proximité", "Homes to rent or buy": "Logements à louer ou à acheter", "Meet new people": "Faire de nouvelles rencontres",
"Used items 40% below market": "Articles d'occasion 40 % sous le prix du marché", "Checked and certified by Nojan": "Vérifiés et certifiés par Nojan",
"No payment online": "Aucun paiement en ligne", "10% of profit to the community": "10 % des profits à la communauté", "What to show": "Quoi afficher",
"Biggest savings": "Plus grosses économies", "New arrivals": "Nouveautés", "See all ›": "Tout voir ›", "View all": "Tout voir", "See all": "Tout voir",
"News": "Nouvelles", "All news ›": "Toutes les nouvelles ›", "What's new at Nojan.": "Quoi de neuf chez Nojan.",
"We launched our GoFundMe": "Nous avons lancé notre GoFundMe",
"Help us grow a business that gives 10% of its profit to the community.": "Aidez-nous à faire grandir une entreprise qui remet 10 % de ses profits à la communauté.",
"Every item now has a Nojan ID": "Chaque article a maintenant un identifiant Nojan",
"Same item from different sellers? See all the offers on one page.": "Le même article chez différents vendeurs? Voyez toutes les offres sur une seule page.",
"Find us at nojans.com": "Retrouvez-nous sur nojans.com", "Our new home on the web. Same shop, easier to remember.": "Notre nouvelle adresse web. La même boutique, plus facile à retenir.",
"Nojan for people": "Nojan pour les gens", "Help Nojan build a business that gives back to the community.": "Aidez Nojan à bâtir une entreprise qui redonne à la communauté.",
"Services are coming soon": "Les services arrivent bientôt", "Classes and expert help, online or in person.": "Des cours et l'aide d'experts, en ligne ou en personne.",
"Loading services…": "Chargement des services…", "Fundraiser": "Collecte de fonds",
/* ---- shop, cards, filters ---- */
"Brand new and used items in one place. Every item shows its condition, who sells it, and whether Nojan has certified it.":
  "Articles neufs et d'occasion au même endroit. Chaque article indique son état, qui le vend et s'il est certifié par Nojan.",
"Sort by": "Trier par", "Featured": "En vedette", "Price: low to high": "Prix : croissant", "Price: high to low": "Prix : décroissant",
"More filters": "Plus de filtres", "Filter items": "Filtrer les articles", "Filter services": "Filtrer les services", "Filter products": "Filtrer les produits",
"Close filters": "Fermer les filtres", "New or used": "Neuf ou d'occasion", "Brand new": "Neuf", "Brand New": "Neuf", "Used": "D'occasion",
"Sold by": "Vendu par", "Product type": "Type de produit", "Brand": "Marque", "Condition of used items": "État des articles d'occasion", "Condition": "État",
"Price": "Prix", "Any price": "Tous les prix", "Lowest price": "Prix le plus bas", "Highest price": "Prix le plus élevé", "From $": "De $", "To $": "À $",
"to": "à", "Any": "Tous", "Clear": "Effacer", "More": "Plus", "On sale": "En solde", "In stock only": "En stock seulement", "In stock": "En stock",
"Certified only": "Certifiés seulement", "Clear all": "Tout effacer", "Jump to a category": "Aller à une catégorie", "All": "Tous", "Show": "Afficher",
"No items to filter yet.": "Aucun article à filtrer pour le moment.", "No brands listed for this type.": "Aucune marque pour ce type.",
"No brands listed yet.": "Aucune marque pour le moment.", "Condition grades appear here once items have one.": "Les cotes d'état apparaîtront ici dès que des articles en auront une.",
"Fragrances": "Parfums", "Jewelry & gifts": "Bijoux et cadeaux", "Personal care & grooming": "Soins personnels", "Health & fitness": "Santé et mise en forme",
"Headphones & audio": "Écouteurs et audio", "Computers & office": "Informatique et bureau", "Cameras & photo": "Appareils photo", "Phones, tablets & e-readers": "Téléphones, tablettes et liseuses",
"Kitchen & cooking": "Cuisine", "Air purifiers & humidifiers": "Purificateurs d'air et humidificateurs", "Home & cleaning": "Maison et entretien",
"Clothing & shoes": "Vêtements et chaussures", "Sports & outdoors": "Sports et plein air", "Toys, games & LEGO": "Jouets, jeux et LEGO",
"Furniture": "Meubles", "Books": "Livres", "Other": "Autre", "Like new": "Comme neuf", "Good": "Bon", "Fair": "Passable",
"Previous photo": "Photo précédente", "Next photo": "Photo suivante", "Price on request": "Prix sur demande", "View": "Voir", "Sold out": "Épuisé", "Add": "Ajouter",
"Quantity in cart": "Quantité dans le panier", "Remove from cart": "Retirer du panier", "Decrease quantity": "Diminuer la quantité", "Increase quantity": "Augmenter la quantité",
"Sorry, this item is sold out": "Désolé, cet article est épuisé", "Added to cart": "Ajouté au panier", "in stock": "en stock",
"No items match “": "Aucun article ne correspond à « ", "”. Try another word.": " ». Essayez un autre mot.", "Results for “": "Résultats pour « ",
"New items are added often. Check back soon.": "De nouveaux articles sont ajoutés souvent. Revenez bientôt.", "Only 1 left": "Plus qu'un en stock",
"Save": "Économisez", "· by": "· par", "Regular": "Prix courant", "incl. HST": "TVH incl.", "incl. HST ·": "TVH incl. ·", "From": "À partir de",
"Ask for price": "Demander le prix", "Members": "Membres", "Certified": "Certifié", "Checked in person and certified by Nojan": "Vérifié en personne et certifié par Nojan",
"Online": "En ligne", "In person": "En personne", "Group class": "Cours de groupe", "Category": "Catégorie", "Provider": "Fournisseur",
"How it's held": "Déroulement", "Class size": "Taille du groupe", "Level": "Niveau", "Other services": "Autres services", "Clear search": "Effacer la recherche",
"No services match these filters.": "Aucun service ne correspond à ces filtres.", "Clear filters": "Effacer les filtres", "Loading items…": "Chargement des articles…",
"No items match these filters.": "Aucun article ne correspond à ces filtres.", "to see everything.": "pour tout voir.", "No items here yet. Follow": "Aucun article pour le moment. Suivez",
"for new posts.": "pour les nouvelles publications.", "Brand new · never used": "Neuf · jamais utilisé", "Sealed, never used, and priced below market.": "Scellé, jamais utilisé et vendu sous le prix du marché.",
"Sealed & unused": "Scellé et inutilisé", "Original packaging, never opened.": "Emballage d'origine, jamais ouvert.", "Everyday low prices": "Bas prix tous les jours",
"We keep our margins small.": "Nous gardons nos marges petites.", "Checked before listing": "Vérifié avant la mise en vente", "Model and contents confirmed.": "Modèle et contenu confirmés.",
"Pre-owned & checked": "Usagé et vérifié", "Pre-owned, tested, and honestly described.": "Usagé, testé et décrit honnêtement.", "Tested to work": "Testé et fonctionnel",
"Powered on, assembled or tried out.": "Allumé, assemblé ou essayé.", "Wear is disclosed": "L'usure est indiquée", "Scratches and marks named in the listing.": "Rayures et marques mentionnées dans l'annonce.",
"Pickup in Richmond Hill": "Cueillette à Richmond Hill", "See it in person before you pay.": "Voyez-le en personne avant de payer.",
"Loading items from Instagram…": "Chargement des articles depuis Instagram…", "Condition guide": "Guide de l'état", "How we describe condition": "Comment nous décrivons l'état",
"No visible wear. Works perfectly, often with box or accessories.": "Aucune usure visible. Fonctionne parfaitement, souvent avec la boîte ou les accessoires.",
"Light signs of use such as small scratches. Fully working.": "Légères traces d'usage, comme de petites rayures. Entièrement fonctionnel.",
"Noticeable wear, priced lower. Works as described in the post.": "Usure visible, prix plus bas. Fonctionne comme décrit dans l'annonce.",
"Buying new": "Acheter neuf", "Buying new with us": "Acheter neuf chez nous", "Confirm": "Confirmer", "We contact you to confirm stock and your total, HST included.": "Nous communiquons avec vous pour confirmer le stock et votre total, TVH incluse.",
"Pay": "Payer", "Pay by e-Transfer or cash at pickup. No card details are entered online.": "Payez par virement Interac ou comptant à la cueillette. Aucune carte n'est saisie en ligne.",
"Receive": "Recevoir", "Pick up in Richmond Hill or arrange local delivery.": "Cueillette à Richmond Hill ou livraison locale.",
"No description yet. Ask us about this item.": "Pas encore de description. Posez-nous vos questions sur cet article.",
/* ---- item page ---- */
"Loading item…": "Chargement de l'article…", "This item is no longer available. It may have sold.": "Cet article n'est plus disponible. Il a peut-être été vendu.",
"See what's in stock": "Voir ce qui est en stock", "offers for this item ›": "offres pour cet article ›", "offers for this item": "offres pour cet article",
"Same item, ID": "Même article, identifiant", ", from different sellers.": ", chez différents vendeurs.", "Nojan item ID": "Identifiant Nojan", "Copy": "Copier",
"Quantity": "Quantité", "One fewer": "Un de moins", "One more": "Un de plus", "Added to Bag ✓": "Ajouté au sac ✓", "Add to Bag": "Ajouter au sac",
"We'll email you to confirm a pickup time, or ask about local delivery.": "Nous vous écrirons pour confirmer l'heure de cueillette, ou demandez la livraison locale.",
"Pay at pickup": "Payer à la cueillette", "e-Transfer or cash. Nothing is charged online. Plus HST.": "Virement Interac ou comptant. Rien n'est facturé en ligne. TVH en sus.",
"Questions about this item? Message us ›": "Des questions sur cet article? Écrivez-nous ›", "Highlights": "Points forts", "Ask": "Demander", "A member": "Un membre",
"Item ID copied": "Identifiant copié", "Link copied": "Lien copié", "Battery": "Batterie", "Tested": "Testé",
/* ---- cart & checkout ---- */
"Your cart": "Votre panier", "Your cart is empty.": "Votre panier est vide.", "Continue shopping": "Continuer à magasiner", "Increase": "Augmenter", "Decrease": "Diminuer",
"Remove": "Retirer", "Subtotal": "Sous-total", "HST 13% (estimate)": "TVH 13 % (estimation)", "Estimated total": "Total estimé", "Proceed to checkout": "Passer à la caisse",
"No payment is taken online. We'll contact you to confirm and arrange payment.": "Aucun paiement n'est pris en ligne. Nous vous contacterons pour confirmer et organiser le paiement.",
"We couldn't connect to the account service. Check your connection and refresh the page.": "Impossible de joindre le service de compte. Vérifiez votre connexion et actualisez la page.",
"Loading your account…": "Chargement de votre compte…", "Sign in to place your order": "Connectez-vous pour passer votre commande",
"Browsing is open to everyone. To place an order, sign in or create a free account so you can track your orders and we can reach you.":
  "Tout le monde peut magasiner. Pour commander, connectez-vous ou créez un compte gratuit afin de suivre vos commandes et que nous puissions vous joindre.",
"Sign in with email": "Se connecter avec un courriel", "Create account": "Créer un compte", "Your contact information": "Vos coordonnées", "Signed in as": "Connecté en tant que",
". We don't ask for card or bank details. After you place the order, we'll email or call you to confirm availability, payment and pickup or delivery.":
  ". Nous ne demandons aucune information de carte ou bancaire. Après votre commande, nous vous écrirons ou vous appellerons pour confirmer la disponibilité, le paiement et la cueillette ou la livraison.",
"Full name": "Nom complet", "Phone": "Téléphone", "Email": "Courriel", "City": "Ville", "Phone call": "Appel téléphonique", "Text message": "Texto", "Notes": "Notes",
"(optional — pickup time, questions)": "(facultatif — heure de cueillette, questions)", "Place order request": "Envoyer la demande de commande", "Checkout": "Commande",
"Back to cart": "Retour au panier", "Order summary": "Résumé de la commande", "Contact by": "Me joindre par", "HST (est.)": "TVH (est.)", "HST (estimate)": "TVH (estimation)",
"Thank you! Your order request was sent.": "Merci! Votre demande de commande a été envoyée.", "Order number": "Numéro de commande",
"We'll contact you soon to confirm your items and arrange payment and pickup or delivery. You can follow its status in My orders.":
  "Nous vous contacterons bientôt pour confirmer vos articles et organiser le paiement et la cueillette ou la livraison. Suivez son statut dans Mes commandes.",
"View my orders": "Voir mes commandes", "Removed from cart": "Retiré du panier", "Please sign in to place your order.": "Veuillez vous connecter pour passer votre commande.",
"Enter a valid email address, like name@example.com.": "Entrez une adresse courriel valide, comme nom@exemple.com.",
/* ---- contact ---- */
"We're here to help": "Nous sommes là pour vous aider",
"Ask about an item, an order, or holding something for pickup. A real person answers every message.":
  "Posez vos questions sur un article, une commande ou une réservation pour la cueillette. Une vraie personne répond à chaque message.",
"Copy address": "Copier l'adresse", "Email address copied": "Adresse courriel copiée", "Address selected — press copy": "Adresse sélectionnée — appuyez sur copier",
"Send us a DM": "Écrivez-nous en message privé", "Send us a message": "Envoyez-nous un message", "Name": "Nom", "(optional)": "(facultatif)", "Topic": "Sujet",
"Question about an item": "Question sur un article", "An order I placed": "Une commande que j'ai passée", "Something else": "Autre chose", "Message": "Message",
"Send message": "Envoyer le message", "Common questions": "Questions fréquentes", "How do I pay?": "Comment payer?",
"After you place an order, we contact you to confirm. You can pay by Interac e-Transfer or cash at pickup.":
  "Après votre commande, nous communiquons avec vous pour la confirmer. Vous pouvez payer par virement Interac ou comptant à la cueillette.",
"Can I see a used item before buying?": "Puis-je voir un article d'occasion avant de l'acheter?",
"Yes. Pick it up in person and check it before you pay.": "Oui. Venez le chercher en personne et vérifiez-le avant de payer.", "Do you deliver?": "Faites-vous la livraison?",
"Local delivery around Richmond Hill can be arranged when we confirm your order.": "La livraison locale dans la région de Richmond Hill peut être organisée lors de la confirmation de votre commande.",
"Is an item still available?": "Un article est-il encore disponible?", "Items shown here are available. Sold items are removed from the shop.": "Les articles affichés ici sont disponibles. Les articles vendus sont retirés de la boutique.",
"We usually reply within one business day.": "Nous répondons habituellement en un jour ouvrable.", "Message sent. We'll get back to you soon.": "Message envoyé. Nous vous répondrons bientôt.",
"Message sent": "Message envoyé", "Your message wasn't sent. Please try again.": "Votre message n'a pas été envoyé. Veuillez réessayer.",
/* ---- order statuses ---- */
"New": "Nouvelle", "Contacted": "Contacté", "Ready for pickup": "Prête pour la cueillette", "Completed": "Terminée", "Cancelled": "Annulée",
"We received your order and will contact you soon to confirm it.": "Nous avons reçu votre commande et vous contacterons bientôt pour la confirmer.",
"We've reached out to confirm your order. Please check your phone and email.": "Nous vous avons contacté pour confirmer votre commande. Vérifiez votre téléphone et vos courriels.",
"Your order is ready for pickup in Richmond Hill. Reply to this email to set a pickup time.": "Votre commande est prête à Richmond Hill. Répondez à ce courriel pour fixer l'heure de cueillette.",
"Your order is complete. Thank you for shopping with Nojan!": "Votre commande est terminée. Merci d'avoir magasiné chez Nojan!",
"Your order was cancelled. If this is a mistake, just reply to this email.": "Votre commande a été annulée. S'il s'agit d'une erreur, répondez simplement à ce courriel.",
"Open": "Ouvrir",
/* ---- sign in & account ---- */
"Continue with Google": "Continuer avec Google", "Continue with Microsoft": "Continuer avec Microsoft",
"That email and password don't match. Try again, or reset your password.": "Ce courriel et ce mot de passe ne correspondent pas. Réessayez ou réinitialisez votre mot de passe.",
"No account uses that email. Create an account instead.": "Aucun compte n'utilise ce courriel. Créez plutôt un compte.",
"An account already uses that email. Sign in instead, or reset your password.": "Un compte utilise déjà ce courriel. Connectez-vous ou réinitialisez votre mot de passe.",
"Use a password with at least 6 characters.": "Utilisez un mot de passe d'au moins 6 caractères.", "Too many tries. Wait a few minutes and try again.": "Trop de tentatives. Attendez quelques minutes et réessayez.",
"No connection. Check your internet and try again.": "Aucune connexion. Vérifiez Internet et réessayez.",
"Your browser blocked the sign-in window. Allow pop-ups for this site and try again.": "Votre navigateur a bloqué la fenêtre de connexion. Autorisez les fenêtres contextuelles pour ce site et réessayez.",
"This sign-in option isn't enabled for this web address yet.": "Cette option de connexion n'est pas encore activée pour cette adresse web.",
"You already have an account with this email. Sign in the way you did before (Google or email and password).": "Vous avez déjà un compte avec ce courriel. Connectez-vous comme avant (Google ou courriel et mot de passe).",
"This sign-in option isn't switched on yet. Please use Google or email for now.": "Cette option de connexion n'est pas encore activée. Utilisez Google ou un courriel pour l'instant.",
"Something went wrong. Please try again.": "Un problème est survenu. Veuillez réessayer.", "Hello,": "Bonjour,", "Sign in or create an account": "Connectez-vous ou créez un compte",
"Reset your password": "Réinitialiser votre mot de passe", "Create your account": "Créer votre compte",
"Enter your email and we'll send you a link to set a new password.": "Entrez votre courriel et nous vous enverrons un lien pour choisir un nouveau mot de passe.",
"Send reset link": "Envoyer le lien", "Back to sign in": "Retour à la connexion", "Sign in or create account": "Se connecter ou créer un compte", "or use your email": "ou utilisez votre courriel",
"(optional, so we can call about orders)": "(facultatif, pour vous appeler au sujet des commandes)", "Password": "Mot de passe", "(at least 6 characters)": "(au moins 6 caractères)",
"Forgot your password?": "Mot de passe oublié?", "You can browse without an account. You need one to place an order.": "Vous pouvez magasiner sans compte. Il en faut un pour commander.",
"Sign out": "Se déconnecter", "Your details": "Vos renseignements", "Please confirm your email address. We sent a link to": "Veuillez confirmer votre adresse courriel. Nous avons envoyé un lien à",
"I've confirmed it": "C'est confirmé", "Send it again": "Renvoyer", "(sign-in address)": "(adresse de connexion)", "Date of birth": "Date de naissance", "Age": "Âge",
"Street address": "Adresse", "(type it, then pick from the list)": "(tapez-la, puis choisissez dans la liste)", "e.g. 10268 Yonge Street": "ex. 10268, rue Yonge",
"Address suggestions": "Suggestions d'adresse", "Unit / Apt": "App. / Unité", "Province": "Province", "Postal code": "Code postal", "Save details": "Enregistrer",
"Shortcuts": "Raccourcis", "My orders": "Mes commandes", "Go to cart": "Aller au panier", "Signed in": "Connecté",
"Alberta": "Alberta", "British Columbia": "Colombie-Britannique", "Manitoba": "Manitoba", "New Brunswick": "Nouveau-Brunswick", "Newfoundland and Labrador": "Terre-Neuve-et-Labrador",
"Nova Scotia": "Nouvelle-Écosse", "Northwest Territories": "Territoires du Nord-Ouest", "Nunavut": "Nunavut", "Ontario": "Ontario", "Prince Edward Island": "Île-du-Prince-Édouard",
"Quebec": "Québec", "Saskatchewan": "Saskatchewan", "Yukon": "Yukon", "Search by OpenStreetMap": "Recherche par OpenStreetMap",
"No matches yet. Keep typing, or add the city.": "Aucun résultat. Continuez à taper ou ajoutez la ville.",
"Still connecting, try again in a moment": "Connexion en cours, réessayez dans un instant", "Still connecting. Try again in a moment.": "Connexion en cours. Réessayez dans un instant.",
"You're signed out": "Vous êtes déconnecté", "Email confirmed": "Courriel confirmé", "Not confirmed yet. Click the link in the email first.": "Pas encore confirmé. Cliquez d'abord sur le lien dans le courriel.",
"Confirmation email sent": "Courriel de confirmation envoyé", "Order cancelled": "Commande annulée", "Account created. Check your email to confirm it.": "Compte créé. Vérifiez vos courriels pour le confirmer.",
"If an account uses that email, a reset link is on its way. Check your inbox and spam folder.": "Si un compte utilise ce courriel, un lien est en route. Vérifiez votre boîte de réception et vos indésirables.",
"Please check your date of birth.": "Vérifiez votre date de naissance.", "Please check your postal code (like L4C 3B2).": "Vérifiez votre code postal (comme L4C 3B2).",
"Please add your city.": "Ajoutez votre ville.", "Details saved.": "Renseignements enregistrés.", "Couldn't save. Try again.": "Échec de l'enregistrement. Réessayez.",
"Not connected. Refresh the page and try again.": "Non connecté. Actualisez la page et réessayez.", "Couldn't save. Check your connection and try again.": "Échec de l'enregistrement. Vérifiez votre connexion et réessayez.",
"That didn't go through. Please try again.": "Cela n'a pas fonctionné. Veuillez réessayer.",
/* ---- my orders ---- */
"Sign in to see your orders and bookings": "Connectez-vous pour voir vos commandes et réservations",
"Your orders, bookings and their status show here after you sign in.": "Vos commandes, réservations et leur statut s'affichent ici une fois connecté.",
"Event tickets": "Billets d'événements", "No event tickets yet.": "Aucun billet pour le moment.", "Find an event": "Trouver un événement", "Bookings": "Réservations", "Orders": "Commandes",
"Loading your orders…": "Chargement de vos commandes…", "You haven't placed any orders yet.": "Vous n'avez encore passé aucune commande.", "Start shopping": "Commencer à magasiner",
"Order #": "Commande no ", "Cancel this order": "Annuler cette commande", "Manage it": "Gérer",
/* ---- services ---- */
"Computer training": "Formation en informatique", "Online courses": "Cours en ligne", "Tutoring": "Tutorat", "Tech support & setup": "Soutien technique et installation",
"Business services": "Services aux entreprises", "Language lessons": "Cours de langue", "Monday": "Lundi", "Tuesday": "Mardi", "Wednesday": "Mercredi", "Thursday": "Jeudi",
"Friday": "Vendredi", "Saturday": "Samedi", "Sunday": "Dimanche", "Requested": "Demandée", "Confirmed": "Confirmée",
"We received your booking request and will confirm it soon.": "Nous avons reçu votre demande de réservation et la confirmerons bientôt.",
"Your booking is confirmed. See you then!": "Votre réservation est confirmée. À bientôt!", "Thanks for joining. We hope it was helpful!": "Merci de votre présence. Nous espérons que cela vous a été utile!",
"This booking was cancelled. If this is a mistake, reply to this email.": "Cette réservation a été annulée. S'il s'agit d'une erreur, répondez à ce courriel.",
"We missed you at this session. Reply to this email to book another time.": "Vous avez manqué cette séance. Répondez à ce courriel pour réserver un autre moment.",
"Free": "Gratuit", "All levels": "Tous niveaux", "Beginner": "Débutant", "Intermediate": "Intermédiaire", "Advanced": "Avancé", "1-on-1": "Individuel", "One-on-one": "Individuel", "Book a time": "Réserver un moment",
"Classes and expert help, online or in person. Pick a time and pay at your session.": "Des cours et l'aide d'experts, en ligne ou en personne. Choisissez un moment et payez à la séance.",
"Tell us what you'd like to learn": "Dites-nous ce que vous aimeriez apprendre",
"Join from home on your computer, tablet or phone. Your meeting link comes with your confirmation.": "Participez de chez vous avec votre ordinateur, tablette ou téléphone. Le lien de la rencontre accompagne votre confirmation.",
"Meet in Richmond Hill or, for some services, at your home or office. The exact place is confirmed with your booking.": "Rencontre à Richmond Hill ou, pour certains services, chez vous ou au bureau. Le lieu exact est confirmé avec votre réservation.",
"Easy to change": "Facile à modifier", "See all your bookings in one place and cancel from": "Voyez toutes vos réservations au même endroit et annulez dans", "if your plans change.": "si vos plans changent.",
"This service isn't available anymore.": "Ce service n'est plus offert.", "Format": "Format", "Online or in person, your choice": "En ligne ou en personne, à votre choix",
"Online on": "En ligne sur", "Video call, link sent before class": "Appel vidéo, lien envoyé avant le cours", "Location": "Lieu", "Session length": "Durée de la séance",
"View full profile: experience, education & certifications ›": "Voir le profil complet : expérience, formation et certifications ›", "How the classes work": "Comment se déroulent les cours",
"About this service": "À propos de ce service", "Booking & cancellation": "Réservation et annulation",
"Pick an open time. Your spot is held right away, and we confirm by email, usually within a day.": "Choisissez un moment libre. Votre place est retenue tout de suite et nous confirmons par courriel, habituellement en moins d'un jour.",
"For online sessions, the meeting link comes with your confirmation and also shows in My bookings.": "Pour les séances en ligne, le lien est envoyé avec votre confirmation et s'affiche aussi dans Mes réservations.",
"The exact address is confirmed with your booking.": "L'adresse exacte est confirmée avec votre réservation.",
"No payment online. Pay the provider by Interac e-Transfer or cash, at or before the session.": "Aucun paiement en ligne. Payez le fournisseur par virement Interac ou comptant, au plus tard à la séance.",
"Plans changed? Cancel from My bookings": "Changement de plans? Annulez dans Mes réservations",
"Plans changed? Cancel from My bookings, ideally at least 24 hours before.": "Changement de plans? Annulez dans Mes réservations, idéalement au moins 24 heures avant.",
"Book this service": "Réserver ce service", "How would you like to attend?": "Comment souhaitez-vous participer?", "How to attend": "Comment participer",
"1. Choose a date": "1. Choisissez une date", "Dates": "Dates", "2. Choose a time": "2. Choisissez une heure", "All times are Toronto time (ET)": "Toutes les heures sont à l'heure de Toronto (HE)",
"Times": "Heures", "Booked": "Réservé", "Available": "Disponible", "Continue": "Continuer", "Select a time to continue": "Choisissez une heure pour continuer",
"No open times in the next": "Aucune disponibilité dans les", "days.": "prochains jours.", "Ask us about other times": "Demandez-nous d'autres moments",
"No payment online. You'll get a confirmation by email.": "Aucun paiement en ligne. Vous recevrez une confirmation par courriel.", "Change time": "Changer l'heure",
"3. Sign in to book": "3. Connectez-vous pour réserver", "Sign in or create a free account so you can see and manage your bookings.": "Connectez-vous ou créez un compte gratuit pour voir et gérer vos réservations.",
"3. Your details": "3. Vos renseignements", "Address for the session": "Adresse de la séance", "What would you like to focus on?": "Sur quoi aimeriez-vous vous concentrer?",
"e.g. I'm new to computers and want to learn email and video calls": "ex. Je débute en informatique et veux apprendre le courriel et les appels vidéo",
"Request booking": "Demander la réservation", "See your bookings in": "Voyez vos réservations dans", "You're booked in! Request #B": "C'est réservé! Demande no B",
"(Toronto time) ·": "(heure de Toronto) ·", "Your spot is held. We'll email you to confirm": "Votre place est retenue. Nous vous écrirons pour confirmer",
"usually within a day. A copy of this request was sent to": "habituellement en moins d'un jour. Une copie de cette demande a été envoyée à",
"Browse more services": "Voir d'autres services", "Richmond Hill, ON": "Richmond Hill (Ont.)", "· with": "· avec", "Join the online session": "Rejoindre la séance en ligne",
"Where:": "Où :", "Add to calendar": "Ajouter au calendrier", "Loading your bookings…": "Chargement de vos réservations…", "No bookings yet.": "Aucune réservation pour le moment.",
"Browse services and classes": "Voir les services et les cours", "No upcoming bookings.": "Aucune réservation à venir.", "Book a service": "Réserver un service",
"Past and cancelled bookings (": "Réservations passées et annulées (", "Booking cancelled": "Réservation annulée", "Couldn't cancel. Contact us instead.": "Annulation impossible. Contactez-nous plutôt.",
"That time is no longer available. Please pick another.": "Ce moment n'est plus disponible. Choisissez-en un autre.",
"Sorry, that time was just booked. Please pick another time.": "Désolé, ce moment vient d'être réservé. Choisissez une autre heure.",
"On request": "Sur demande", "on request": "sur demande", "What happens next": "La suite", "Your spot is held. We'll confirm by email, usually within a day.": "Votre place est retenue. Nous confirmerons par courriel, habituellement en moins d'un jour.",
"Meet our providers": "Nos fournisseurs", "This profile isn't available.": "Ce profil n'est pas disponible.", "See all services": "Voir tous les services", "Loading…": "Chargement…",
"Present": "Aujourd'hui", "Issued": "Délivré", "Show credential ↗": "Voir le titre ↗", "Company": "Entreprise", "See services": "Voir les services", "Message the shop": "Écrire à la boutique",
"View profile ›": "Voir le profil ›", "About": "À propos", "Experience": "Expérience", "Education": "Formation", "Licences & certifications": "Permis et certifications",
"Skills": "Compétences", "Languages": "Langues", "Individual": "Particulier", "On LinkedIn": "Sur LinkedIn", "on LinkedIn ↗": "sur LinkedIn ↗", "Website ↗": "Site web ↗",
"Live from LinkedIn · updates automatically": "En direct de LinkedIn · mise à jour automatique", "Freelance": "Pigiste", "Contract": "Contrat", "Internship": "Stage", "Volunteer": "Bénévole",
"Service name": "Nom du service",
"Contact": "Contact", "About Nojan": "À propos de Nojan", "Test before you pay": "Testez avant de payer", "Test before you pay ›": "Testez avant de payer ›",
"What Certified means": "Ce que veut dire « Certifié »", "Privacy": "Confidentialité", "Terms": "Conditions", "Privacy policy": "Politique de confidentialité", "Terms of use": "Conditions d'utilisation",
"Page not found": "Page introuvable", "This page doesn't exist or has moved.": "Cette page n'existe pas ou a été déplacée.", "Go to the shop": "Aller à la boutique",
"Total": "Total", "No tax added. Nothing is charged online.": "Aucune taxe ajoutée. Rien n'est facturé en ligne.", "No tax added ·": "Aucune taxe ajoutée ·",
"Send your order request. Nothing is charged.": "Envoyez votre demande de commande. Rien n'est facturé.",
"We contact you, usually within one business day, to set a pickup time in Richmond Hill.": "Nous communiquons avec vous, habituellement en moins d'un jour ouvrable, pour fixer un moment de cueillette à Richmond Hill.",
"Test the item at pickup, then pay by e-Transfer or cash.": "Testez l'article à la cueillette, puis payez par virement Interac ou comptant.",
"By placing an order you agree to our": "En passant commande, vous acceptez nos", "and to": "et le principe", ".": ".",
"e-Transfer or cash, after you test the item. Nothing is charged online.": "Virement Interac ou comptant, après avoir testé l'article. Rien n'est facturé en ligne.",
"Open it and try it at pickup. Once you pay, the sale is final.": "Ouvrez-le et essayez-le à la cueillette. Une fois payé, la vente est finale.",
"Similar items": "Articles similaires", "We contact you to confirm stock and your total.": "Nous communiquons avec vous pour confirmer le stock et votre total.",
"Can I test an item before I pay?": "Puis-je tester un article avant de payer?",
"Yes, always. Take as long as you need at pickup. If it works and matches the listing, you pay. If not, you don't have to buy it.": "Oui, toujours. Prenez le temps qu'il vous faut à la cueillette. S'il fonctionne et correspond à l'annonce, vous payez. Sinon, vous n'êtes pas obligé de l'acheter.",
"Can I return an item?": "Puis-je retourner un article?",
"Because you test and accept items before paying, sales are final once paid. Opening a sealed box means you buy the item unless it's faulty.": "Comme vous testez et acceptez les articles avant de payer, la vente est finale une fois payée. Ouvrir une boîte scellée signifie que vous achetez l'article, sauf s'il est défectueux.",
"Read the details": "Lire les détails",
"Brand-name items for less.": "Des articles de marque pour moins cher.",
"New and used electronics, kitchen appliances, fragrances and more, below regular prices. Checked by us, picked up in Richmond Hill, and tested by you before you pay.": "Électronique, électroménagers de cuisine, parfums et plus, neufs et d'occasion, sous les prix courants. Vérifiés par nous, récupérés à Richmond Hill et testés par vous avant de payer.",
"How buying works": "Comment acheter", "How it works": "Comment ça marche", "Order online": "Commandez en ligne", "Nothing is charged online.": "Rien n'est facturé en ligne.",
"We contact you": "Nous vous contactons", "Usually within one business day.": "Habituellement en moins d'un jour ouvrable.", "Test, then pay": "Testez, puis payez",
"At pickup in Richmond Hill, by e-Transfer or cash.": "À la cueillette à Richmond Hill, par virement Interac ou comptant.",
"Shop by category": "Magasiner par catégorie", "Zoom": "Zoom", "Programming": "Programmation",
"Sun": "dim.", "Mon": "lun.", "Tue": "mar.", "Wed": "mer.", "Thu": "jeu.", "Fri": "ven.", "Sat": "sam.",
"Jan": "janv.", "Feb": "févr.", "Mar": "mars", "Apr": "avr.", "May": "mai", "Jun": "juin", "Jul": "juill.", "Aug": "août", "Sep": "sept.", "Oct": "oct.", "Nov": "nov.", "Dec": "déc."
};
const MON = {Jan:"janv.",Feb:"févr.",Mar:"mars",Apr:"avr.",May:"mai",Jun:"juin",Jul:"juill.",Aug:"août",Sep:"sept.",Oct:"oct.",Nov:"nov.",Dec:"déc.",
  January:"janvier",February:"février",March:"mars",April:"avril",June:"juin",July:"juillet",August:"août",September:"septembre",October:"octobre",November:"novembre",December:"décembre"};
const DAY = {Sunday:"dimanche",Monday:"lundi",Tuesday:"mardi",Wednesday:"mercredi",Thursday:"jeudi",Friday:"vendredi",Saturday:"samedi"};
const pl = (n, one, many) => (+n > 1 ? many : one);
const dateFR = (m, d, y) => d + " " + (MON[m] || m) + " " + y;
const FRP = [
  [/^(Like new|Good|Fair) · (.+)$/, (_, c, b) => ({"Like new": "Comme neuf", Good: "Bon", Fair: "Passable"})[c] + " · " + b],
  [/^Remove filter (.+)$/, (_, f) => "Retirer le filtre " + (FR[f] || f)],
  [/^(\d+) items? in your bag · (.+)$/, (_, n, t) => n + pl(n, " article", " articles") + " dans votre sac · " + t],
  [/^(\d+) added to your bag$/, (_, n) => n + " ajoutés à votre sac"],
  [/^(\d+) items?$/, (_, n) => n + pl(n, " article", " articles")],
  [/^Show (\d+) items?$/, (_, n) => "Afficher " + n + pl(n, " article", " articles")],
  [/^(\d+) items? in (\d+) categor(?:y|ies)$/, (_, n, c) => n + pl(n, " article", " articles") + " dans " + c + pl(c, " catégorie", " catégories")],
  [/^(\d+) items?, new and used$/, (_, n) => n + pl(n, " article", " articles") + ", neufs et d'occasion"],
  [/^(\d+) services? to book$/, (_, n) => n + pl(n, " service", " services") + " à réserver"],
  [/^Show (\d+) services?$/, (_, n) => "Afficher " + n + pl(n, " service", " services")],
  [/^(\d+) services?$/, (_, n) => n + pl(n, " service", " services")],
  [/^(\d+) services? in (\d+) categor(?:y|ies)$/, (_, n, c) => n + pl(n, " service", " services") + " dans " + c + pl(c, " catégorie", " catégories")],
  [/^Brand new · by (.+)$/, (_, s) => "Neuf · par " + s],
  [/^Used · by (.+)$/, (_, s) => "D'occasion · par " + s],
  [/^Used · (Like new|Good|Fair)$/, (_, c) => "D'occasion · " + ({"Like new": "Comme neuf", Good: "Bon", Fair: "Passable"})[c]],
  [/^Hello, (.+)$/, (_, s) => "Bonjour, " + s],
  [/^Save \$([\d.,]+)$/, (_, a) => "Économisez " + a + " $"],
  [/^(\d+)% off$/, (_, n) => n + " % de rabais"],
  [/^Only (\d+) left$/, (_, n) => "Plus que " + n + " en stock"],
  [/^Order #(\d+)$/, (_, n) => "Commande no " + n],
  [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})$/, (_, m, d, y) => dateFR(m, d, y)],
  [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4}), (\d{1,2}):(\d\d) ([ap])\.m\. · (\d+) item\(s\)$/,
    (_, m, d, y, h, mi, ap, n) => dateFR(m, d, y) + ", " + ((+h % 12) + (ap === "p" ? 12 : 0)) + " h " + mi + " · " + n + pl(n, " article", " articles")],
  [/^Signed in with (Google|Microsoft) as (.+?)\.?$/, (_, p, e) => "Connecté avec " + p + " : " + e + "."],
  [/^(.+), photo (\d+) of (\d+)$/, (_, t, a, b) => t + ", photo " + a + " sur " + b],
  [/^Show photo (\d+)$/, (_, n) => "Afficher la photo " + n],
  [/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), (\w+) (\d{1,2}), (no|\d+) times? open$/,
    (_, d, m, n, k) => DAY[d] + " " + n + " " + (MON[m] || m) + ", " + (k === "no" ? "aucune disponibilité" : k + pl(k, " disponibilité", " disponibilités"))],
  [/^(\d+) open$/, (_, n) => n + pl(n, " libre", " libres")],
  [/^(\d+(?:\.\d+)?) hrs? · one-on-one$/, (_, n) => n + " h · individuel"],
  [/^(\d+(?:\.\d+)?) hrs?$/, (_, n) => n + " h"],
  [/^(\d+) min$/, (_, n) => n + " min"],
  [/^Age (\d+)$/, (_, n) => "Âge " + n],
  [/^See open times & book · on request$/, () => "Voir les disponibilités et réserver · sur demande"],
  [/^See all (\d+) offers for this item ›$/, (_, n) => "Voir les " + n + " offres pour cet article ›"],
  [/^Past and cancelled bookings \((\d+)\)$/, (_, n) => "Réservations passées et annulées (" + n + ")"],
  [/^See all items \((\d+)\)$/, (_, n) => "Voir tous les articles (" + n + ")"],
  [/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), (January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2})(, \d{4})?$/,
    (_, d, m, n, y) => DAY[d] + " " + n + " " + MON[m] + (y ? " " + y.slice(2) : "")]
];

const KEY = "nojanLang";
const norm = t => t.replace(/\s+/g, " ").trim();
const origText = new WeakMap(), lastSet = new WeakMap(), origAttr = new WeakMap();
const ATTRS = ["placeholder", "aria-label", "title"];
let lang = "en";
const tr = en => {
  if (lang !== "fr") return null;
  const k = norm(en); if (!k) return null;
  if (Object.prototype.hasOwnProperty.call(FR, k)) return FR[k];
  for (const [re, f] of FRP) { const m = k.match(re); if (m) return f(...m); }
  return null;
};
const skip = el => !el || el.closest("script,style,textarea,code,[data-noi18n],[contenteditable]");

function doText(n){
  if (skip(n.parentElement)) return;
  let en = origText.get(n);
  if (en === undefined || n.nodeValue !== lastSet.get(n)) { en = n.nodeValue; origText.set(n, en); }   // page changed the text: that's the new English
  if (!norm(en)) return;
  const f = tr(en), m = en.match(/^(\s*)[\s\S]*?(\s*)$/);
  const out = f ? m[1] + f + m[2] : en;
  const p = n.parentElement;
  if (p && p.tagName === "OPTION" && !p.hasAttribute("value")) p.setAttribute("value", norm(en));   // forms still send the English choice
  if (n.nodeValue !== out) n.nodeValue = out;
  lastSet.set(n, out);
}
function doAttrs(el){
  if (skip(el)) return;
  let o = origAttr.get(el);
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    o = o || {}; const cur = el.getAttribute(a);
    if (o[a] === undefined || (o["_" + a] !== cur)) o[a] = cur;
    const out = tr(o[a]) || o[a];
    if (cur !== out) el.setAttribute(a, out);
    o["_" + a] = out;
  }
  if (o) origAttr.set(el, o);
}
function walk(root){
  if (root.nodeType === 3) return doText(root);
  if (root.nodeType !== 1) return;
  doAttrs(root);
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n; while ((n = it.nextNode())) n.nodeType === 3 ? doText(n) : doAttrs(n);
}
let busy = false;
const mo = new MutationObserver(list => {
  if (busy) return; busy = true;
  for (const r of list) {
    if (r.type === "characterData") doText(r.target);
    else if (r.type === "attributes") doAttrs(r.target);
    else r.addedNodes.forEach(walk);
  }
  mo.takeRecords(); busy = false;
});

function setLang(l, save){
  lang = l === "fr" ? "fr" : "en";
  if (save) { try { localStorage.setItem(KEY, lang); } catch(_) {} }
  document.documentElement.lang = lang === "fr" ? "fr-CA" : "en";
  const sw = document.getElementById("langSwitch");
  if (sw) { sw.dataset.on = lang; sw.querySelectorAll("[data-lang]").forEach(b => b.setAttribute("aria-pressed", b.dataset.lang === lang)); }
  busy = true; walk(document.body); mo.takeRecords(); busy = false;
}
window.NOJAN_LANG = { set: setLang, get: () => lang, FR, FRP };

document.addEventListener("click", e => {
  const b = e.target.closest("#langSwitch [data-lang]"); if (!b) return;
  setLang(b.dataset.lang, true);
});
mo.observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS});

let saved = null; try { saved = localStorage.getItem(KEY); } catch(_) {}
if (saved) setLang(saved, false);
else {
  // v93: French when the browser's first language is French. No internet-address lookup, nothing is sent anywhere.
  const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""]).map(x => String(x).toLowerCase());
  const fr = !!langs[0] && langs[0].startsWith("fr");
  setLang(fr ? "fr" : "en", false);
  if (fr && typeof toast === "function") setTimeout(() => toast("Affiché en français · EN pour l'anglais"), 600);
}
})();
/* v57: installable app — register the offline helper */
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
